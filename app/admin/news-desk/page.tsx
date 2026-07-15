import { requireAdminPage } from '@/lib/admin-auth';
import { getNewsroomSnapshot } from '@/lib/newsroom-queries';
import NewsDesk, { type SerializedNewsroomSnapshot } from './_components/NewsDesk';

export const dynamic = 'force-dynamic';

export default async function NewsDeskPage() {
  await requireAdminPage('/admin/news-desk');

  const snapshot = await getNewsroomSnapshot({ eventLimit: 100, activityLimit: 40 });
  const initialSnapshot = JSON.parse(
    JSON.stringify(snapshot),
  ) as SerializedNewsroomSnapshot;

  return (
    <NewsDesk
      initialSnapshot={initialSnapshot}
      automationEnabled={process.env.BBSPORTS_REALTIME_NEWSROOM_ENABLED !== 'false'}
    />
  );
}
