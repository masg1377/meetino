'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { CreateMeetingRequest, MeetingDto } from '@meetino/shared';
import { apiClient, ApiError } from '@/lib/api-client';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { FormField } from '@/components/ui/FormField';
import { Alert } from '@/components/ui/Alert';

const schema = z.object({
  title: z
    .string()
    .min(1, 'عنوان جلسه را وارد کنید')
    .max(200, 'عنوان نمی‌تواند بیشتر از ۲۰۰ کاراکتر باشد'),
  description: z.string().max(2000, 'توضیحات نمی‌تواند بیشتر از ۲۰۰۰ کاراکتر باشد').optional(),
});
type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (meeting: MeetingDto) => void;
}

export function CreateMeetingModal({ open, onClose, onCreated }: Props) {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      const payload: CreateMeetingRequest = {
        title: values.title,
        ...(values.description ? { description: values.description } : {}),
      };
      const meeting = await apiClient.post<MeetingDto>('/meetings', payload);
      reset();
      onCreated(meeting);
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'ساخت جلسه با خطا مواجه شد.');
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!isSubmitting) {
          reset();
          setServerError(null);
          onClose();
        }
      }}
      title="ایجاد جلسه جدید"
      footer={
        <>
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={() => {
              if (!isSubmitting) {
                reset();
                setServerError(null);
                onClose();
              }
            }}
          >
            انصراف
          </Button>
          <Button
            type="submit"
            form="create-meeting-form"
            variant="primary"
            size="md"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'در حال ساخت…' : 'ایجاد جلسه'}
          </Button>
        </>
      }
    >
      <form id="create-meeting-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {serverError && <Alert variant="error">{serverError}</Alert>}

        <FormField label="عنوان جلسه" htmlFor="title" error={errors.title?.message}>
          <Input
            id="title"
            invalid={!!errors.title}
            placeholder="مثلاً کلاس فرانت‌اند — جلسه ۳"
            {...register('title')}
          />
        </FormField>

        <FormField
          label="توضیحات (اختیاری)"
          htmlFor="description"
          error={errors.description?.message}
          hint="چند خط درباره موضوع جلسه برای شرکت‌کنندگان"
        >
          <Textarea
            id="description"
            rows={4}
            invalid={!!errors.description}
            placeholder="موضوع جلسه را به‌اختصار توضیح دهید…"
            {...register('description')}
          />
        </FormField>
      </form>
    </Modal>
  );
}
