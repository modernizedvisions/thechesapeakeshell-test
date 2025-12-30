export type OrderConfirmationEmailItem = {
  name: string;
  qty?: number | null;
  unitAmount?: number | null;
  lineTotal: number;
  imageUrl?: string | null;
};

export type OrderConfirmationEmailParams = {
  brandName: string;
  orderNumber: string;
  orderDate: string;
  customerName?: string | null;
  customerEmail?: string | null;
  shippingAddress?: string | null;
  billingAddress?: string | null;
  paymentMethod?: string | null;
  items: OrderConfirmationEmailItem[];
  subtotal: number;
  shipping: number;
  total: number;
  primaryCtaUrl: string;
  primaryCtaLabel?: string;
};

export function renderOrderConfirmationEmailHtml(params: OrderConfirmationEmailParams): string {
  const brand = params.brandName || 'Order';
  const orderLabel = params.orderNumber || 'Order';
  const customerName = params.customerName || 'Customer';
  const customerEmail = params.customerEmail || '';
  const shippingAddress = params.shippingAddress || '';
  const billingAddress = params.billingAddress || '';
  const paymentMethod = params.paymentMethod || 'Card';
  const primaryCtaLabel = params.primaryCtaLabel || 'Visit Store';

  const itemRows = (params.items || []).map((item) => {
    const qty = item.qty && item.qty > 1 ? `x ${item.qty}` : '';
    const img = item.imageUrl
      ? `<img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.name)}" width="64" height="64" style="object-fit:cover; display:block; border:1px solid #e5e7eb;" />`
      : '';
    return `
      <tr>
        <td style="padding:16px 0; border-bottom:1px solid #ededed;">
          <table role="presentation" style="width:100%; border-collapse:collapse;">
            <tr>
              ${img ? `<td style="width:72px; padding-right:16px; vertical-align:top;">${img}</td>` : ''}
              <td style="vertical-align:top;">
                <div style="font-family: 'Playfair Display', Georgia, 'Times New Roman', serif; font-size:16px; color:#111827; font-weight:600; margin:0 0 2px;">
                  ${escapeHtml(item.name)}${qty ? ` <span style="font-size:13px; color:#6b7280; font-weight:500;">${qty}</span>` : ''}
                </div>
              </td>
              <td style="vertical-align:top; text-align:right; font-family:'Playfair Display', Georgia, 'Times New Roman', serif; font-size:15px; color:#111827; font-weight:600; white-space:nowrap;">${formatMoney(item.lineTotal)}</td>
            </tr>
          </table>
        </td>
      </tr>
    `;
  }).join('') || `
    <tr>
      <td style="padding:12px 0; color:#6b7280; font-family:'Playfair Display', Georgia, 'Times New Roman', serif; font-size:14px;">No items found.</td>
    </tr>
  `;

  const shippingBlock = shippingAddress ? formatMultilineAddress(shippingAddress) : 'Not provided';
  const billingBlock = billingAddress ? formatMultilineAddress(billingAddress) : (shippingAddress ? 'Same as shipping' : 'Not provided');

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ffffff; padding:0; margin:0;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:600px; max-width:600px; border-collapse:collapse;">
            <tr>
              <td style="padding-bottom:24px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%; border-collapse:collapse;">
                  <tr>
                    <td style="font-family:'Playfair Display', Georgia, 'Times New Roman', serif; font-size:20px; font-weight:600; color:#111827;">
                      ${escapeHtml(brand)}
                    </td>
                    <td align="right" style="font-family:'Playfair Display', Georgia, 'Times New Roman', serif; font-size:12px; letter-spacing:0.12em; color:#6b7280; text-transform:uppercase;">
                      ORDER # ${escapeHtml(orderLabel)}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding-bottom:28px;">
                <div style="font-family:'Playfair Display', Georgia, 'Times New Roman', serif; font-size:28px; font-weight:600; color:#111827; margin-bottom:6px;">
                  Thank you for your purchase!
                </div>
                <div style="font-family:'Playfair Display', Georgia, 'Times New Roman', serif; font-size:14px; color:#6b7280; margin-bottom:18px;">
                  ${escapeHtml(brand)}
                </div>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;">
                  <tr>
                    <td>
                      <a href="${escapeHtml(params.primaryCtaUrl)}" style="display:block; text-align:center; padding:14px 0; background:#111827; color:#ffffff; text-decoration:none; font-family:'Playfair Display', Georgia, 'Times New Roman', serif; font-size:14px; letter-spacing:0.04em; text-transform:uppercase;">
                        ${escapeHtml(primaryCtaLabel)}
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding-bottom:24px;">
                <div style="font-family:'Playfair Display', Georgia, 'Times New Roman', serif; font-size:14px; letter-spacing:0.12em; color:#6b7280; text-transform:uppercase; margin-bottom:8px;">
                  Order summary
                </div>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%; border-collapse:collapse;">
                  ${itemRows}
                </table>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%; margin-top:16px;">
                  <tr>
                    <td align="right">
                      <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                        <tr>
                          <td style="padding:4px 0; font-size:14px; color:#6b7280; font-family:'Playfair Display', Georgia, 'Times New Roman', serif;">Subtotal</td>
                          <td style="padding:4px 0 4px 24px; font-size:14px; color:#111827; font-family:'Playfair Display', Georgia, 'Times New Roman', serif; font-weight:600; text-align:right;">${formatMoney(params.subtotal)}</td>
                        </tr>
                        <tr>
                          <td style="padding:4px 0; font-size:14px; color:#6b7280; font-family:'Playfair Display', Georgia, 'Times New Roman', serif;">Shipping</td>
                          <td style="padding:4px 0 4px 24px; font-size:14px; color:#111827; font-family:'Playfair Display', Georgia, 'Times New Roman', serif; font-weight:600; text-align:right;">${formatMoney(params.shipping)}</td>
                        </tr>
                        <tr>
                          <td style="padding:10px 0 0; font-size:16px; color:#111827; font-family:'Playfair Display', Georgia, 'Times New Roman', serif; font-weight:700;">Total</td>
                          <td style="padding:10px 0 0 24px; font-size:16px; color:#111827; font-family:'Playfair Display', Georgia, 'Times New Roman', serif; font-weight:700; text-align:right;">${formatMoney(params.total)}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding-bottom:24px;">
                <div style="font-family:'Playfair Display', Georgia, 'Times New Roman', serif; font-size:14px; letter-spacing:0.12em; color:#6b7280; text-transform:uppercase; margin-bottom:12px;">
                  Customer information
                </div>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%; border-collapse:collapse;">
                  <tr>
                    <td style="width:50%; vertical-align:top; padding-right:16px;">
                      <div style="font-size:12px; letter-spacing:0.12em; text-transform:uppercase; color:#6b7280; margin-bottom:6px; font-family:'Playfair Display', Georgia, 'Times New Roman', serif;">
                        Shipping address
                      </div>
                      <div style="font-size:14px; color:#111827; line-height:1.5; font-family:'Playfair Display', Georgia, 'Times New Roman', serif;">
                        ${shippingBlock}
                      </div>
                    </td>
                    <td style="width:50%; vertical-align:top; padding-left:16px;">
                      <div style="font-size:12px; letter-spacing:0.12em; text-transform:uppercase; color:#6b7280; margin-bottom:6px; font-family:'Playfair Display', Georgia, 'Times New Roman', serif;">
                        Billing address
                      </div>
                      <div style="font-size:14px; color:#111827; line-height:1.5; font-family:'Playfair Display', Georgia, 'Times New Roman', serif;">
                        ${billingBlock}
                      </div>
                    </td>
                  </tr>
                </table>
                <div style="margin-top:16px;">
                  <div style="font-size:12px; letter-spacing:0.12em; text-transform:uppercase; color:#6b7280; margin-bottom:6px; font-family:'Playfair Display', Georgia, 'Times New Roman', serif;">
                    Payment method
                  </div>
                  <div style="font-size:14px; color:#111827; font-family:'Playfair Display', Georgia, 'Times New Roman', serif;">
                    ${escapeHtml(paymentMethod)}
                  </div>
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding-top:16px; font-size:12px; color:#6b7280; font-family:'Playfair Display', Georgia, 'Times New Roman', serif; text-align:left;">
                If you have any questions, reply to this email.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

export function renderOrderConfirmationEmailText(params: OrderConfirmationEmailParams): string {
  const primaryCtaLabel = params.primaryCtaLabel || 'Visit Store';
  const lines = [
    `${params.brandName || 'Order'} - Order Confirmed`,
    `Order: ${params.orderNumber || ''}`.trim(),
    `Placed: ${params.orderDate || ''}`.trim(),
    `Customer: ${params.customerName || 'Customer'}`,
    params.customerEmail ? `Email: ${params.customerEmail}` : null,
    params.shippingAddress ? `Shipping: ${params.shippingAddress}` : 'Shipping: Not provided',
    params.billingAddress ? `Billing: ${params.billingAddress}` : 'Billing: Same as shipping',
    params.paymentMethod ? `Payment: ${params.paymentMethod}` : 'Payment: Card',
    '',
    'Items:',
    ...(params.items || []).map((item) => {
      const qty = item.qty && item.qty > 1 ? ` x${item.qty}` : '';
      return `- ${item.name}${qty}: ${formatMoney(item.lineTotal)}`;
    }),
    '',
    `Subtotal: ${formatMoney(params.subtotal)}`,
    `Shipping: ${formatMoney(params.shipping)}`,
    `Total: ${formatMoney(params.total)}`,
    '',
    `${primaryCtaLabel}: ${params.primaryCtaUrl}`,
    'If you have any questions, reply to this email.',
  ].filter(Boolean) as string[];

  return lines.join('\n');
}

export function formatMoney(cents: number | null | undefined): string {
  const value = Number.isFinite(cents as number) ? Number(cents) / 100 : 0;
  return `$${value.toFixed(2)}`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatMultilineAddress(value: string) {
  if (!value) return '';
  return escapeHtml(value).replace(/\n+/g, '<br/>');
}
