import { redirect } from 'next/navigation';

export default function MeetingRootPage({ params }: { params: { slug: string } }) {
  redirect(`/m/${params.slug}/prejoin`);
}
