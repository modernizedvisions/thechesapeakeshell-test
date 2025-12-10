import React, { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type AdminMessage = {
  id?: string;
  name?: string;
  email?: string;
  message?: string;
  imageUrl?: string | null;
  createdAt?: string | null;
};

export interface AdminMessagesTabProps {
  messages: AdminMessage[];
  onCreateCustomOrderFromMessage: (message: {
    customerName?: string;
    customerEmail?: string;
    description?: string;
    messageId?: string;
  }) => void;
}

export const AdminMessagesTab: React.FC<AdminMessagesTabProps> = ({ messages, onCreateCustomOrderFromMessage }) => {
  const [selectedMessage, setSelectedMessage] = useState<AdminMessage | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const sortedMessages = useMemo(
    () =>
      [...messages].sort((a, b) => {
        const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bDate - aDate;
      }),
    [messages]
  );

  const openMessage = (msg: AdminMessage) => {
    setSelectedMessage(msg);
    setIsDialogOpen(true);
  };

  const handleCreateOrder = () => {
    if (!selectedMessage) return;
    onCreateCustomOrderFromMessage({
      customerName: selectedMessage.name,
      customerEmail: selectedMessage.email,
      description: selectedMessage.message,
      messageId: selectedMessage.id,
    });
    setIsDialogOpen(false);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Messages</h2>
        <p className="text-sm text-gray-600">Customer messages from the contact form.</p>
      </div>

      {sortedMessages.length === 0 ? (
        <div className="text-sm text-gray-500">No messages yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Name</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Email</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Received</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Preview</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {sortedMessages.map((msg) => (
                <tr key={msg.id || `${msg.email}-${msg.createdAt}`}>
                  <td className="px-4 py-2 text-sm text-gray-900">{msg.name || 'Unknown'}</td>
                  <td className="px-4 py-2 text-sm text-gray-900">{msg.email || '—'}</td>
                  <td className="px-4 py-2 text-sm text-gray-700">
                    {msg.createdAt ? new Date(msg.createdAt).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-700">
                    {(msg.message || '').length > 80 ? `${msg.message?.slice(0, 80)}…` : msg.message || '—'}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      className="text-sm font-medium text-gray-700 underline"
                      onClick={() => openMessage(msg)}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Message Details</DialogTitle>
          </DialogHeader>

          {selectedMessage && (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase">Name</p>
                <p className="text-sm text-gray-900">{selectedMessage.name || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase">Email</p>
                <p className="text-sm text-gray-900">{selectedMessage.email || '—'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase">Message</p>
                <p className="whitespace-pre-wrap text-sm text-gray-900">{selectedMessage.message || '—'}</p>
              </div>
              {selectedMessage.imageUrl && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Image</p>
                  <img
                    src={selectedMessage.imageUrl}
                    alt="Customer upload"
                    className="max-h-64 w-full rounded-lg object-cover border border-gray-200"
                  />
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:border-gray-400"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
                  onClick={handleCreateOrder}
                >
                  Create Custom Order
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
