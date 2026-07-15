/**
 * Release operator for the published working-copy edit gate.
 *
 * Keep edits disabled while an old replica could still read mutable article
 * columns. Enable only after the new immutable-snapshot readers have fully
 * converged. Disable before any rollback that can reintroduce an old reader.
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import postgres from 'postgres';

export const PUBLICATION_CONTROL_KEY = 'published_working_copy_edits_v1';
export const PUBLICATION_CONTROL_CAPABILITY = 'publication-runtime-controls-v1';
export const PUBLICATION_ENABLE_CONFIRMATION =
  'ENABLE ONLY AFTER ALL OLD ARTICLE READERS ARE DRAINED';
export const PUBLICATION_DISABLE_CONFIRMATION =
  'DISABLE BEFORE OLD ARTICLE READERS RETURN';

type ControlAction = 'status' | 'enable' | 'disable';

type ControlOptions = Readonly<{
  action: ControlAction;
  actor: string | null;
  capability: string | null;
  confirmation: string | null;
  deploymentSha: string | null;
}>;

function safeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Unknown publication control failure.';
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]');
}

function optionValue(argument: string, name: string): string | null {
  const prefix = `--${name}=`;
  return argument.startsWith(prefix) ? argument.slice(prefix.length) : null;
}

export function parsePublicationControlOptions(arguments_: readonly string[]): ControlOptions {
  const [actionInput, ...optionArguments] = arguments_;
  if (actionInput !== 'status' && actionInput !== 'enable' && actionInput !== 'disable') {
    throw new Error('Usage: publication-working-copy-control <status|enable|disable> [options].');
  }
  const values = new Map<string, string>();
  for (const argument of optionArguments) {
    const matchedName = ['actor', 'capability', 'confirm', 'deploy-sha'].find(
      (name) => optionValue(argument, name) !== null,
    );
    if (!matchedName) throw new Error(`Unknown publication control option: ${argument}`);
    if (values.has(matchedName)) throw new Error(`Duplicate --${matchedName} option.`);
    values.set(matchedName, optionValue(argument, matchedName) ?? '');
  }
  return {
    action: actionInput,
    actor: values.get('actor') ?? null,
    capability: values.get('capability') ?? null,
    confirmation: values.get('confirm') ?? null,
    deploymentSha: values.get('deploy-sha')?.toLocaleLowerCase('en-US') ?? null,
  };
}

function validateMutationOptions(options: ControlOptions): void {
  if (!options.actor || options.actor.trim().length < 2 || options.actor.trim().length > 160) {
    throw new Error('Mutation commands require --actor with 2 to 160 characters.');
  }
  if (options.capability !== PUBLICATION_CONTROL_CAPABILITY) {
    throw new Error('Mutation command capability confirmation is missing or incorrect.');
  }
  const expectedConfirmation =
    options.action === 'enable'
      ? PUBLICATION_ENABLE_CONFIRMATION
      : PUBLICATION_DISABLE_CONFIRMATION;
  if (options.confirmation !== expectedConfirmation) {
    throw new Error(`The exact ${options.action} confirmation phrase is required.`);
  }
  if (options.action === 'enable' && !/^[a-f0-9]{40}$/.test(options.deploymentSha ?? '')) {
    throw new Error('Enable requires --deploy-sha with the exact 40-character Git commit SHA.');
  }
  if (
    options.action === 'disable' &&
    options.deploymentSha !== null &&
    !/^[a-f0-9]{40}$/.test(options.deploymentSha)
  ) {
    throw new Error('When provided, --deploy-sha must be the exact 40-character Git commit SHA.');
  }
  const railwaySha = process.env.RAILWAY_GIT_COMMIT_SHA?.toLocaleLowerCase('en-US');
  if (
    options.action === 'enable' &&
    railwaySha &&
    railwaySha !== options.deploymentSha
  ) {
    throw new Error('The requested deploy SHA does not match this Railway runtime.');
  }
}

function printStatus(row: Record<string, unknown>): void {
  console.info(
    JSON.stringify({
      control: PUBLICATION_CONTROL_KEY,
      enabled: row.enabled === true,
      deploymentSha: typeof row.deployment_sha === 'string' ? row.deployment_sha : null,
      changedAt:
        row.changed_at instanceof Date
          ? row.changed_at.toISOString()
          : typeof row.changed_at === 'string'
            ? row.changed_at
            : null,
      changedBy: typeof row.changed_by === 'string' && row.changed_by ? row.changed_by : null,
    }),
  );
}

export async function runPublicationWorkingCopyControl(
  options: ControlOptions,
): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required.');
  const parsedUrl = new URL(databaseUrl);
  const databaseName = decodeURIComponent(parsedUrl.pathname.replace(/^\//, ''));
  if (
    (parsedUrl.protocol !== 'postgres:' && parsedUrl.protocol !== 'postgresql:') ||
    !parsedUrl.hostname ||
    !parsedUrl.username ||
    !databaseName
  ) {
    throw new Error('DATABASE_URL must identify an explicit PostgreSQL database.');
  }
  if (databaseName.startsWith('bbs_pub_verify_')) {
    throw new Error('The release control command refuses a disposable verifier database.');
  }
  if (options.action !== 'status') validateMutationOptions(options);

  const client = postgres(databaseUrl, {
    max: 1,
    idle_timeout: 5,
    connect_timeout: 15,
    ssl: 'prefer',
  });
  try {
    const [preflight] = await client`
      SELECT
        current_database() AS database_name,
        current_setting('transaction_read_only') AS transaction_read_only,
        pg_is_in_recovery() AS in_recovery
    `;
    if (
      preflight?.database_name !== databaseName ||
      preflight.transaction_read_only !== 'off' ||
      preflight.in_recovery !== false
    ) {
      throw new Error('Publication control preflight requires the exact writable primary database.');
    }

    const [triggerContract] = await client`
      SELECT count(*)::int AS count
      FROM pg_trigger
      WHERE (
        tgname = 'publication_runtime_controls_guarded'
        AND tgrelid = 'publication_runtime_controls'::regclass
        AND obj_description(oid, 'pg_trigger') =
          'bbsports:publication-runtime-controls:v1'
      ) OR (
        tgname = 'articles_published_working_copy_edit_guard'
        AND tgrelid = 'articles'::regclass
        AND obj_description(oid, 'pg_trigger') =
          'bbsports:published-working-copy-edit-contract:v1'
      )
    `;
    if (triggerContract?.count !== 2) {
      throw new Error('Publication control triggers are missing or version-mismatched.');
    }

    if (options.action === 'status') {
      const [status] = await client`
        SELECT enabled, deployment_sha, changed_at, changed_by
        FROM publication_runtime_controls
        WHERE control_key = ${PUBLICATION_CONTROL_KEY}
        LIMIT 1
      `;
      if (!status) throw new Error('Publication working-copy control row is missing.');
      printStatus(status);
      return;
    }

    const desiredEnabled = options.action === 'enable';
    const result = await client.begin(async (transaction) => {
      const [current] = await transaction`
        SELECT enabled, deployment_sha, changed_at, changed_by
        FROM publication_runtime_controls
        WHERE control_key = ${PUBLICATION_CONTROL_KEY}
        FOR UPDATE
      `;
      if (!current) throw new Error('Publication working-copy control row is missing.');
      if (current.enabled === desiredEnabled) return current;
      await transaction`
        SELECT set_config('bbsports.publication_activation_contract', 'v1', true)
      `;
      const [updated] = await transaction`
        UPDATE publication_runtime_controls
        SET enabled = ${desiredEnabled},
            deployment_sha = ${options.deploymentSha},
            changed_at = now(),
            changed_by = ${options.actor?.trim() ?? ''},
            updated_at = now()
        WHERE control_key = ${PUBLICATION_CONTROL_KEY}
        RETURNING enabled, deployment_sha, changed_at, changed_by
      `;
      if (!updated) throw new Error('Publication working-copy control update did not persist.');
      return updated;
    });
    printStatus(result);
  } finally {
    await client.end({ timeout: 5 });
  }
}

const invokedPath = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : '';
if (invokedPath === import.meta.url) {
  let options: ControlOptions;
  try {
    options = parsePublicationControlOptions(process.argv.slice(2));
  } catch (error) {
    console.error(`[publication-control] FAIL ${safeErrorMessage(error)}`);
    process.exitCode = 1;
    options = null as never;
  }
  if (options) {
    runPublicationWorkingCopyControl(options).catch((error) => {
      console.error(`[publication-control] FAIL ${safeErrorMessage(error)}`);
      process.exitCode = 1;
    });
  }
}
