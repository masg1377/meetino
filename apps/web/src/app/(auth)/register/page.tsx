'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  displayName: z
    .string()
    .min(2, 'نام نمایشی باید حداقل ۲ کاراکتر باشد')
    .max(120, 'نام نمایشی نمی‌تواند بیشتر از ۱۲۰ کاراکتر باشد'),
  email: z.string().email('ایمیل معتبر نیست'),
  password: z
    .string()
    .min(8, 'رمز عبور باید حداقل ۸ کاراکتر باشد')
    .max(72, 'رمز عبور نمی‌تواند بیشتر از ۷۲ کاراکتر باشد')
    .regex(/[A-Za-z]/, 'رمز عبور باید حداقل یک حرف داشته باشد')
    .regex(/[0-9]/, 'رمز عبور باید حداقل یک رقم داشته باشد'),
});
type FormValues = z.infer<typeof schema>;

export default function RegisterPage() {
  const { register: doRegister } = useAuth();
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      await doRegister(values);
      router.push('/dashboard');
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(err.message);
      } else {
        setServerError('ثبت‌نام با مشکل مواجه شد. لطفاً دوباره تلاش کنید.');
      }
    }
  };

  return (
    <AuthCard
      title="ساخت حساب کاربری"
      subtitle="با ساخت حساب می‌توانید جلسه ایجاد کنید و میزبان آن باشید."
      footer={
        <>
          قبلاً ثبت‌نام کرده‌اید؟{' '}
          <Link href="/login" className="font-medium text-brand-700 hover:text-brand-800">
            ورود به حساب
          </Link>
        </>
      }
    >
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {serverError && <Alert variant="error">{serverError}</Alert>}

        <FormField label="نام نمایشی" htmlFor="displayName" error={errors.displayName?.message}>
          <Input
            id="displayName"
            type="text"
            autoComplete="name"
            invalid={!!errors.displayName}
            placeholder="مثلاً سارا محمدی"
            {...register('displayName')}
          />
        </FormField>

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

        <FormField
          label="رمز عبور"
          htmlFor="password"
          error={errors.password?.message}
          hint="حداقل ۸ کاراکتر، شامل یک حرف و یک رقم"
        >
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            dir="ltr"
            invalid={!!errors.password}
            {...register('password')}
          />
        </FormField>

        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'در حال ساخت حساب…' : 'ثبت‌نام'}
        </Button>
      </form>
    </AuthCard>
  );
}
