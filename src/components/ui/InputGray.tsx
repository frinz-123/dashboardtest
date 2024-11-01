'use client'

import React from 'react'

type InputGrayProps = {
  label: string
  placeholder?: string
  value: string
  onChange: (value: string) => void
  type?: string
}

export default function InputGray({ 
  label, 
  placeholder = "", 
  value, 
  onChange, 
  type = "text" 
}: InputGrayProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <input
        className="w-full px-3 py-2 border-transparent bg-gray-100 rounded-lg shadow-none focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder={placeholder}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}
