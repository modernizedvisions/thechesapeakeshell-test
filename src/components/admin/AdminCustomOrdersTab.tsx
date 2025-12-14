import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { AdminSectionHeader } from './AdminSectionHeader';

interface AdminCustomOrdersTabProps {
  allCustomOrders: any[];
  onCreateOrder: (data: any) => Promise<void> | void;
  onMarkPaid?: (id: string) => Promise<void> | void;
  onReloadOrders?: () => Promise<void> | void;
  onSendPaymentLink?: (id: string) => Promise<void> | void;
  initialDraft?: any;
  onDraftConsumed?: () => void;
  isLoading?: boolean;
  error?: string | null;
}

export const AdminCustomOrdersTab: React.FC<AdminCustomOrdersTabProps> = ({
  allCustomOrders,
  onCreateOrder,
  onMarkPaid,
  onReloadOrders,
  onSendPaymentLink,
  initialDraft,
  onDraftConsumed,
  isLoading,
  error,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const draftDefaults = useMemo(() => {
    if (!initialDraft) return undefined;
    return {
      customerName: initialDraft.customerName || '',
      customerEmail: initialDraft.customerEmail || '',
      description: initialDraft.description || '',
      amount: initialDraft.amount ?? '',
    };
  }, [initialDraft]);

  const { register, handleSubmit, reset, formState } = useForm({
    defaultValues: {
      customerName: '',
      customerEmail: '',
      description: '',
      amount: '',
    },
  });

  useEffect(() => {
    if (initialDraft) {
      reset(draftDefaults);
      setIsModalOpen(true);
      onDraftConsumed?.();
    }
  }, [initialDraft, draftDefaults, onDraftConsumed, reset]);

  useEffect(() => {
    if (!isModalOpen) {
      reset({
        customerName: '',
        customerEmail: '',
        description: '',
        amount: '',
      });
    }
  }, [isModalOpen, reset]);

  if (import.meta.env.DEV) {
    console.debug('[custom orders tab] render', { count: allCustomOrders.length });
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
      <div className="space-y-3">
        <AdminSectionHeader
          title="Custom Orders"
          subtitle="Manage bespoke customer requests and payment links."
        />
        <div className="flex justify-center sm:justify-end">
          <button
            type="button"
            onClick={() => {
              reset(draftDefaults || { customerName: '', customerEmail: '', description: '', amount: '' });
              setIsModalOpen(true);
            }}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
          >
            New Custom Order
          </button>
          {import.meta.env.DEV && (
            <button
              type="button"
              onClick={() => onReloadOrders?.()}
              className="ml-2 rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:border-gray-400"
            >
              Debug: Reload
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-md border border-gray-200">
        {isLoading ? (
          <div className="p-4 text-sm text-gray-600">Loading custom orders...</div>
        ) : allCustomOrders.length === 0 ? (
          <div className="p-4 text-sm text-gray-600">No custom orders yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-600">
                <tr>
                  <th className="px-4 py-2 text-left">Order ID</th>
                  <th className="px-4 py-2 text-left">Customer</th>
                  <th className="px-4 py-2 text-left">Email</th>
                  <th className="px-4 py-2 text-left">Amount</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Payment Link</th>
                  <th className="px-4 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white text-gray-900">
                {allCustomOrders.map((order) => {
                  const amount = typeof order.amount === 'number' ? order.amount : null;
                  const amountLabel = amount !== null ? `$${(amount / 100).toFixed(2)}` : '–';
                  const statusLabel = order.status || 'pending';
                  const displayId = order.displayCustomOrderId || order.display_custom_order_id || order.id || '–';
                  const hasPaymentLink = !!order.paymentLink;
                  return (
                    <tr key={order.id}>
                      <td className="px-4 py-2 font-mono text-xs text-gray-700">{displayId}</td>
                      <td className="px-4 py-2">{order.customerName || 'Customer'}</td>
                      <td className="px-4 py-2">{order.customerEmail || '–'}</td>
                      <td className="px-4 py-2">{amountLabel}</td>
                      <td className="px-4 py-2 capitalize">{statusLabel}</td>
                      <td className="px-4 py-2 text-xs">
                        {order.paymentLink ? (
                          <a
                            href={order.paymentLink}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 hover:underline"
                            title={order.paymentLink}
                          >
                            Link
                          </a>
                        ) : (
                          '–'
                        )}
                      </td>
                      <td className="px-4 py-2 text-right space-x-2">
                        <button
                          type="button"
                          className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:border-gray-400"
                        >
                          View
                        </button>
                        <button
                          type="button"
                          className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:border-gray-400"
                          disabled={statusLabel === 'paid'}
                          title={statusLabel === 'paid' ? 'Already paid' : ''}
                          onClick={() => onMarkPaid?.(order.id)}
                        >
                          Mark Paid
                        </button>
                        <button
                          type="button"
                          className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 disabled:opacity-60 disabled:cursor-not-allowed"
                          disabled={statusLabel === 'paid'}
                          title={statusLabel === 'paid' ? 'Already paid' : hasPaymentLink ? 'Resend payment link' : ''}
                          onClick={() => onSendPaymentLink?.(order.id)}
                        >
                          {hasPaymentLink ? 'Resend Payment Link' : 'Send Payment Link'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Custom Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <form
              className="space-y-4"
              onSubmit={handleSubmit(async (values) => {
                await onCreateOrder(values);
                setIsModalOpen(false);
              })}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
                  <input
                    {...register('customerName', { required: true })}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer Email</label>
                  <input
                    type="email"
                    {...register('customerEmail', { required: true })}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  rows={4}
                  {...register('description', { required: true })}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (USD)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  {...register('amount', { required: true })}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:border-gray-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formState.isSubmitting}
                  className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60"
                >
                  {formState.isSubmitting ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
