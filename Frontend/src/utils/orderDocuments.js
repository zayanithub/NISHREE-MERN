const cleanText = (value) => String(value ?? '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^\x20-\x7E]/g, '');

const money = (value) => `INR ${(Number(value) || 0).toFixed(2)}`;
const invoiceDate = (value) => value ? new Date(value).toLocaleDateString('en-IN') : '—';

const addressLines = (address = {}) => [
  address.fullName,
  address.addressLine1,
  address.addressLine2,
  address.landmark,
  [address.city, address.state, address.postalCode].filter(Boolean).join(', '),
  address.country,
  address.phone ? `Phone: ${address.phone}` : '',
].filter(Boolean);

const invoiceLines = (order, storeName) => {
  const lines = [
    storeName || 'Nishree Attire',
    'ORDER INVOICE',
    `Order: ${order.orderNumber}`,
    `Invoice date: ${invoiceDate(order.createdAt)}`,
    `Order date: ${invoiceDate(order.createdAt)}`,
    `Customer: ${order.customerName || order.shippingAddress?.fullName || ''}`,
    `Email: ${order.customerEmail || ''}`,
    '',
    'BILL TO / SHIP TO',
    ...addressLines(order.billingAddress || order.shippingAddress),
    '',
    'ITEMS',
  ];

  for (const [index, item] of (order.items || []).entries()) {
    lines.push(`${index + 1}. ${item.productName || 'Product'}${item.categoryName ? ` (${item.categoryName})` : ''}`);
    if (item.variantName) lines.push(`   Option: ${item.variantName}`);
    lines.push(`   SKU: ${item.sku || '—'} | Qty: ${item.quantity} | Unit: ${money(item.unitPrice)}`);
    if (Number(item.discountAmount) > 0) lines.push(`   Item discount: ${money(item.discountAmount)}`);
    lines.push(`   Line total: ${money(item.lineTotal)}`, '');
  }

  lines.push(
    'ORDER TOTALS',
    `Subtotal: ${money(order.subtotal)}`,
    `Discount: -${money(order.discountAmount)}`,
    `Shipping: ${money(order.shippingAmount)}`,
    `Tax: ${money(order.taxAmount)}`,
    `Total: ${money(order.totalAmount)}`,
    '',
    `Payment method: ${order.paymentMethod || '—'}`,
    `Payment status: ${order.paymentStatus || '—'}`,
    `Order status: ${String(order.orderStatus || '—').replaceAll('_', ' ')}`,
    '',
    'Thank you for shopping with Nishree Attire.',
  );
  return lines.flatMap((line) => {
    const text = cleanText(line);
    if (text.length <= 88) return [text];
    const wrapped = [];
    let remaining = text;
    while (remaining.length > 88) {
      let splitAt = remaining.lastIndexOf(' ', 88);
      if (splitAt < 1) splitAt = 88;
      wrapped.push(remaining.slice(0, splitAt));
      remaining = `  ${remaining.slice(splitAt).trimStart()}`;
    }
    wrapped.push(remaining);
    return wrapped;
  });
};

const escapePdfText = (text) => text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

const makePdfBlob = (lines) => {
  const pageLines = [];
  for (let index = 0; index < lines.length; index += 48) pageLines.push(lines.slice(index, index + 48));
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pageLines.map((_, index) => `${4 + index * 2} 0 R`).join(' ')}] /Count ${pageLines.length} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];

  pageLines.forEach((page, pageIndex) => {
    const pageObjectId = 4 + pageIndex * 2;
    const contentObjectId = pageObjectId + 1;
    const commands = page.map((line, index) => {
      const fontSize = index === 0 ? 16 : index === 1 ? 12 : 9;
      const y = 780 - index * 15;
      return `BT /F1 ${fontSize} Tf 48 ${y} Td (${escapePdfText(line)}) Tj ET`;
    });
    commands.push(`BT /F1 8 Tf 48 28 Td (Page ${pageIndex + 1} of ${pageLines.length}) Tj ET`);
    const stream = commands.join('\n');
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjectId} 0 R >>`);
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });

  let document = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(document.length);
    document += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = document.length;
  document += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) document += `${String(offset).padStart(10, '0')} 00000 n \n`;
  document += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new Blob([document], { type: 'application/pdf' });
};

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const createInvoicePdf = (order, storeName) => makePdfBlob(invoiceLines(order, storeName));

export const downloadInvoicePdf = (order, storeName) => {
  const filename = `Nishree-invoice-${cleanText(order.orderNumber || order._id).replace(/\s+/g, '-')}.pdf`;
  downloadBlob(createInvoicePdf(order, storeName), filename);
};

export const downloadOrderSummary = (order) => {
  const lines = invoiceLines(order, 'Nishree Attire · Order summary');
  downloadBlob(new Blob([lines.join('\r\n')], { type: 'text/plain;charset=utf-8' }), `Nishree-order-${cleanText(order.orderNumber || order._id).replace(/\s+/g, '-')}-summary.txt`);
};
