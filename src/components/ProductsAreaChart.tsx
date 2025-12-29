"use client";

import React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  TooltipProps,
} from "recharts";

interface ProductData {
  code: string;
  product: string;
  quantity: number;
  percentOfCode: number;
}

interface ProductsAreaChartProps {
  data: ProductData[];
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: TooltipProps<number, string>) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as ProductData;
    return (
      <div className="bg-white p-3 border border-gray-200 shadow-lg rounded-lg">
        <p className="font-semibold text-sm text-gray-800">{data.product}</p>
        <p className="text-xs text-gray-500 mb-2">Código: {data.code}</p>
        <p className="text-sm font-medium text-blue-600">
          Cantidad: {data.quantity}
        </p>
        <p className="text-xs text-gray-500">
          {data.percentOfCode
            ? `${(data.percentOfCode * 100).toFixed(1)}% del código`
            : ""}
        </p>
      </div>
    );
  }
  return null;
};

export default function ProductsAreaChart({ data }: ProductsAreaChartProps) {
  if (!data || data.length === 0) return null;

  return (
    <div className="w-full h-[300px] mb-6 bg-white p-4 rounded-lg border border-gray-100">
      <h4 className="text-sm font-medium text-gray-500 mb-4">
        Distribución de Cantidad por Producto
      </h4>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{
            top: 10,
            right: 30,
            left: 0,
            bottom: 0,
          }}
        >
          <defs>
            <linearGradient id="colorQuantity" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="#f0f0f0"
          />
          <XAxis
            dataKey="product"
            tick={{ fontSize: 10, fill: "#6b7280" }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            tickFormatter={(value) =>
              value.length > 15 ? `${value.substring(0, 15)}...` : value
            }
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#6b7280" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="quantity"
            stroke="#3b82f6"
            fillOpacity={1}
            fill="url(#colorQuantity)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
