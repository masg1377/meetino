'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import { Alert } from '@/components/ui/Alert';
import { AuthCard } from '@/components/ui/AuthCard';

const schema = z.object({
  email: z.string().email('ایمیل معتبر نیست'),
  password: z.string().min(1, 'رمز عبور الزامی است'),
});
type FormValues = z.infer<typeof schema>;

// useSearchParams باید داخل Suspense باشد — این کامپوننت جدا wrap می‌شود
function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get('next') ?? '/dashboard';
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      await login(values);
      router.push(nextPath);
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(err.message);
      } else {
        setServerError('ورود ناموفق بود. لطفاً دوباره تلاش کنید.');
      }
    }
  };

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {serverError && <Alert variant="error">{serverError}</Alert>}

      <FormField label="ایمیل" htmlFor="email" error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          dir="ltr"
          invalid={!!errors.email}
          placeholder="you@example.com"
          {...register('email')}
        />
      </FormField>

      <FormField label="رمز عبور" htmlFor="password" error={errors.password?.message}>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          dir="ltr"
          invalid={!!errors.password}
          {...register('password')}
        />
      </FormField>

      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'در حال ورود…' : 'ورود'}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <AuthCard
      title="ورود به میتینو"
      subtitle="برای ساخت و مدیریت جلسه‌ها وارد حساب کاربری خود شوید."
      footer={
        <>
          حساب کاربری ندارید؟{' '}
          <Link href="/register" className="font-medium text-brand-700 hover:text-brand-800">
            ثبت‌نام کنید
          </Link>
        </>
      }
    >
      <Suspense fallback={<div className="h-40" />}>
        <LoginForm />
      </Suspense>
    </AuthCard>
  );
}
