import { ArticleEditor } from '../_components/ArticleEditor';
import { requireAdminPage } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export default async function NewArticlePage() {
  await requireAdminPage('/admin/articles/new');
  return <ArticleEditor mode="new" />;
}
