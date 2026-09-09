import { Order } from '../types';

export function printOrderReceipt(order: Order, storeName?: string, socialLinks?: any) {
  const itemsHtml = (order.items || []).map(item => `
    <div class="item-row">
      <span>${item.quantity}x ${item.name}</span>
      <span>R$ ${(item.price * item.quantity).toFixed(2)}</span>
    </div>
    ${item.pizzaMode === 'MEIO_A_MEIO' && item.secondFlavor ? `<div style="font-size:10px; padding-left:10px; color:#555;">• 1/2 ${item.firstFlavor?.name || item.name} + 1/2 ${item.secondFlavor.name}</div>` : ''}
    ${(item.selectedComplements || []).map(c => `<div style="font-size:10px; padding-left:10px; color:#555;">+ ${c.name}</div>`).join('')}
  `).join('');

  const displayOrderNum = order.orderNumber 
    ? String(order.orderNumber).padStart(4, '0') 
    : order.id.substring(0, 5).toUpperCase();

  const formattedWa = socialLinks?.whatsapp 
    ? (socialLinks.whatsapp.startsWith('55') ? socialLinks.whatsapp.substring(2) : socialLinks.whatsapp) 
    : '34-9-9262-7077';

  const addressLine = socialLinks?.address || 'AV. LUCAS BORGES, 586 - FABRÍCIO';
  const cityLine = socialLinks?.city || 'UBERABA - MG';

  const printContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Cupom Pedido #${displayOrderNum}</title>
      <style>
        @page { margin: 0; size: auto; }
        body { 
          margin: 0; 
          padding: 8px; 
          font-family: 'Courier New', Courier, monospace; 
          background: #fff; 
          color: #000; 
          font-weight: 600; 
          font-size: 13px;
          line-height: 1.3;
        }
        .coupon-content { 
          width: 300px; 
          margin: 0 auto; 
          padding: 10px 4px; 
        }
        .header { 
          text-align: center; 
          border-bottom: 2px dashed #000; 
          padding-bottom: 10px; 
          margin-bottom: 10px; 
        }
        .header h1 { 
          font-size: 18px; 
          font-weight: 900; 
          margin: 0; 
          text-transform: uppercase;
        }
        .header h2 { 
          font-size: 16px; 
          font-weight: 800; 
          margin: 5px 0; 
          text-transform: uppercase;
        }
        .info { 
          border-bottom: 2px dashed #000; 
          padding-bottom: 10px; 
          margin-bottom: 10px; 
          font-weight: 700; 
        }
        .info p { margin: 3px 0; }
        .items { 
          border-bottom: 2px dashed #000; 
          padding-bottom: 10px; 
          margin-bottom: 10px; 
          font-weight: 700; 
        }
        .item-row { 
          display: flex; 
          justify-content: space-between; 
          margin-bottom: 4px; 
        }
        .totals { 
          font-size: 14px; 
          font-weight: 700; 
        }
        .totals p { 
          margin: 3px 0; 
          display: flex; 
          justify-content: space-between; 
        }
        .total-final { 
          font-size: 18px; 
          font-weight: 900; 
          margin-top: 10px; 
          border-top: 2px solid #000; 
          padding-top: 6px; 
          display: flex; 
          justify-content: space-between; 
        }
        .footer { 
          text-align: center; 
          font-size: 11px; 
          margin-top: 20px; 
          font-weight: 700; 
          line-height: 1.4;
        }
        .footer p { margin: 3px 0; }
        .site-highlight {
          font-size: 13px !important;
          font-weight: 900 !important;
          margin-top: 6px !important;
          letter-spacing: 0.5px;
        }
        @media print { 
          @page { margin: 0; } 
          body { margin: 0; } 
        }
      </style>
    </head>
    <body>
      <div class="coupon-content">
        <div class="header">
          <h1>${storeName || 'BELLA BORDA'}</h1>
          <h2>Pedido #${displayOrderNum}</h2>
          <p>${new Date(order.createdAt).toLocaleString('pt-BR')}</p>
        </div>
        <div class="info">
          <p><strong>Cli:</strong> ${order.customerName}</p>
          <p><strong>Tel:</strong> ${order.customerPhone}</p>
          <p><strong>Status:</strong> ${order.status}</p>
          <p><strong>Pag:</strong> ${order.paymentMethod}</p>
          ${order.changeFor ? `<p><strong>Troco p/:</strong> R$ ${order.changeFor.toFixed(2)}</p>` : ''}
          ${order.deliveryType === 'DELIVERY' ? `<p><strong>End:</strong> ${order.customerAddress}</p>` : (order.deliveryType === 'TABLE' ? `<p><strong>${order.customerAddress}</strong></p>` : '<p><strong>RETIRADA NO BALCÃO</strong></p>')}
          ${order.couponCode ? `<p><strong>Cupom:</strong> ${order.couponCode}</p>` : ''}
        </div>
        <div class="items">${itemsHtml}</div>
        <div class="totals">
          <p><span>Subtotal:</span> <span>R$ ${(order.total - order.deliveryFee + (order.discountValue || 0)).toFixed(2)}</span></p>
          ${order.deliveryFee > 0 ? `<p><span>Taxa Entrega:</span> <span>R$ ${order.deliveryFee.toFixed(2)}</span></p>` : ''}
          ${order.discountValue ? `<p><span>Desconto:</span> <span>- R$ ${order.discountValue.toFixed(2)}</span></p>` : ''}
          <div class="total-final">
            <span>TOTAL:</span>
            <span>R$ ${order.total.toFixed(2)}</span>
          </div>
          ${order.changeFor ? `<p>Troco: R$ ${(order.changeFor - order.total).toFixed(2)}</p>` : ''}
        </div>
        <div class="footer">
          <p style="font-size: 12px; font-weight: 800; margin-bottom: 4px;">Obrigado pela preferência!</p>
          <p>${storeName || 'BELLA BORDA'} PIZZARIA</p>
          <p>${addressLine}</p>
          <p>${cityLine} - FONE: ${formattedWa}</p>
          <p class="site-highlight">www.bellaborda.com.br</p>
        </div>
      </div>
      <script>
        window.onload = function() { 
          window.print(); 
          setTimeout(function() { window.close(); }, 500); 
        }
      </script>
    </body>
    </html>
  `;

  try {
    const printWindow = window.open('', '_blank', 'width=350,height=600,menubar=no,toolbar=no,location=no,status=no,titlebar=no');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(printContent);
      printWindow.document.close();
    }
  } catch (e) {
    console.error("Print error:", e);
  }
}
