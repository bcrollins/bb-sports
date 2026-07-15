import { notFound } from 'next/navigation';
import { requireAdminPage } from '@/lib/admin-auth';
import { getArticleById } from '@/lib/queries';
import {
  hashArticleEditableState,
  hashArticlePublicationSnapshot,
} from '@/lib/article-publication';
import { articlePublicationSnapshotFromArticle } from '@/lib/article-publication-queries';
import { ArticleEditor } from '../../_components/ArticleEditor';

export const dynamic = 'force-dynamic';

export default async function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAdminPage(`/admin/articles/${id}/edit`);
  const a = await getArticleById(id);
  if (!a) notFound();
  let initialDraftHash: string | null = null;
  try {
    initialDraftHash = hashArticlePublicationSnapshot(
      articlePublicationSnapshotFromArticle(a),
    );
  } catch {
    // An incomplete draft remains editable but cannot enter approval yet.
  }
  return (
    <ArticleEditor
      mode="edit"
      userRole={user.role}
      initialDraftHash={initialDraftHash}
      initialEditToken={hashArticleEditableState(a)}
      initial={{
        id: a.id,
        slug: a.slug,
        title: a.title,
        dek: a.dek,
        body: a.body,
        sport: a.sport,
        hero: a.hero,
        heroAlt: a.heroAlt,
        heroCredit: a.heroCredit,
        authorName: a.authorName,
        aiAssisted: a.aiAssisted,
        bradsTake: a.bradsTake,
      }}
    />
  );
}
