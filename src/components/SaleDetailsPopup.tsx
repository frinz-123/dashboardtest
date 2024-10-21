import React from 'react'
import { X } from 'lucide-react'

type Sale = {
  clientName: string;
  fechaSinHora: string;
  venta: number;
  products: Record<string, number>;
}

type SaleDetailsPopupProps = {
  sale: Sale
  onClose: () => void
}

export default function SaleDetailsPopup({ sale, onClose }: SaleDetailsPopupProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Detalles de la Venta</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>
        <p className="mb-2"><strong>Cliente:</strong> {sale.clientName}</p>
        <p className="mb-2"><strong>Fecha:</strong> {sale.fechaSinHora}</p>
        <p className="mb-4"><strong>Total:</strong> ${sale.venta.toFixed(2)}</p>
        <h3 className="font-semibold mb-2">Productos:</h3>
        <ul>
          {Object.entries(sale.products).map(([product, quantity]) => (
            <li key={product} className="mb-1">
              <span className="font-medium">{product}:</span> {quantity}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
