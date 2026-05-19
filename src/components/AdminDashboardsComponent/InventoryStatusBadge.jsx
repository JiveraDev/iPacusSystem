import { Badge } from '../../ui/badge';

export default function InventoryStatusBadge({ status, count }) {
  const variants = {
    'in-stock': {
      className: 'bg-[#e0f2e9] text-[#0c6a3c] hover:bg-[#e0f2e9]',
      text: 'In Stock'
    },
    'low-stock': {
      className: 'bg-[#fff4e6] text-[#b54708] hover:bg-[#fff4e6]',
      text: 'Low Stock'
    },
    'out-of-stock': {
      className: 'bg-[#ffe6e6] text-[#d92d20] hover:bg-[#ffe6e6]',
      text: 'Out of Stock'
    },
    'expired': {
      className: 'bg-[#ffe6e6] text-[#d92d20] hover:bg-[#ffe6e6]',
      text: 'Expired'
    },
    'near-expiry': {
      className: 'bg-[#fff4e6] text-[#b54708] hover:bg-[#fff4e6]',
      text: 'Near Expiry'
    },
    'damaged': {
      className: 'bg-[#f3f3f5] text-[#4a5565] hover:bg-[#f3f3f5]',
      text: 'Damaged'
    },
    'destroyed': {
      className: 'bg-[#1f1f1f] text-white hover:bg-[#1f1f1f]',
      text: 'Destroyed'
    }
  };

  const config = variants[status];

  return (
    <Badge className={config.className}>
      {config.text}
      {count !== undefined && ` (${count})`}
    </Badge>
  );
}
