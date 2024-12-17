'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Bell, Plus, Search, Settings, Package, ChevronRight, LayoutGrid, TableIcon, Box, Tag, DollarSign, Clock, AlertCircle, Minus, TrendingUp, Menu } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Label } from "@/components/ui/label"
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { 
  CartesianGrid, 
  LabelList, 
  BarChart as RechartsBarChart, 
  Bar as RechartsBar, 
  XAxis as RechartsXAxis, 
  YAxis as RechartsYAxis,
  Area,
  AreaChart
} from "recharts"
import Link from 'next/link'

const spreadsheetId = process.env.NEXT_PUBLIC_SPREADSHEET_ID

console.log('Environment Variables:', {
  spreadsheetId: process.env.NEXT_PUBLIC_SPREADSHEET_ID,
  sheetName2: process.env.NEXT_PUBLIC_SHEET_NAME2,
  sheetName3: process.env.NEXT_PUBLIC_SHEET_NAME3
});

interface Articulo {
  id: number;
  nombre: string;
  categoria: string;
  precio: number;
  cantidad: number;
  estado: string;
  ultimaActualizacion: string;
  peso: number;
}

interface Cantidades {
  [key: number]: number;
}

interface ModalInventarioProps {
  estaAbierto: boolean;
  setEstaAbierto: (value: boolean) => void;
  articulos: Articulo[];
  alGuardar: (cantidades: Cantidades) => void;
}

async function fetchProductos(): Promise<Articulo[]> {
  const sheetName = process.env.NEXT_PUBLIC_SHEET_NAME2 || 'Productos'
  try {
    console.log('Attempting to fetch from sheet:', sheetName);
    if (!sheetName) {
      throw new Error('Sheet name is undefined');
    }

    // First get an access token
    const tokenResponse = await fetch('/api/auth/token');
    if (!tokenResponse.ok) {
      throw new Error('Failed to get access token');
    }
    const { access_token } = await tokenResponse.json();
    
    console.log('Got access token:', access_token); // Debug log
    console.log('Sheet name:', sheetName); // Debug log
    console.log('Spreadsheet ID:', spreadsheetId); // Debug log

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A2:D`;
    console.log('Fetching from URL:', url); // Debug log

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${access_token}`,
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error:', errorText); // Debug log
      throw new Error(`Failed to fetch productos: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Received data:', data); // Debug log
    
    if (!data.values || !Array.isArray(data.values)) {
      console.log('No values found in response'); // Debug log
      return [];
    }

    return data.values.map((row: any[], index: number) => {
      console.log('Processing row:', row); // Debug log
      return {
        id: index + 1,
        nombre: row[0] || '',
        categoria: row[1] || '',
        precio: parseFloat(row[2]) || 0,
        peso: parseFloat(row[3]) || 0,
        cantidad: 0,
        estado: 'Pendiente',
        ultimaActualizacion: 'Nuevo'
      };
    });
  } catch (error) {
    console.error('Error in fetchProductos:', error);
    throw error; // Re-throw to be handled by the component
  }
}

async function fetchEntradas(): Promise<Record<string, { cantidad: number; peso: number }>> {
  const sheetName = process.env.NEXT_PUBLIC_SHEET_NAME3
  try {
    const tokenResponse = await fetch('/api/auth/token');
    const { access_token } = await tokenResponse.json();

    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A2:D`,
      {
        headers: {
          'Authorization': `Bearer ${access_token}`,
        }
      }
    );

    if (!response.ok) throw new Error('Failed to fetch entradas');

    const data = await response.json();
    const cantidades: Record<string, { cantidad: number; peso: number }> = {};

    if (!data.values) return cantidades;

    data.values.forEach((row: any[]) => {
      const nombre = row[0];
      const cantidad = parseInt(row[2]) || 0;
      const peso = parseFloat(row[3]) || 0;
      
      if (!cantidades[nombre]) {
        cantidades[nombre] = { cantidad: 0, peso: 0 };
      }
      cantidades[nombre].cantidad += cantidad;
      cantidades[nombre].peso += peso;
    });

    return cantidades;
  } catch (error) {
    console.error('Error fetching entradas:', error);
    return {};
  }
}

type EntradaSource = 'Produccion' | 'Inventario Inicial' | 'Retorno de vendedor' | '';

interface Entrada {
  nombre: string;
  categoria: string;
  cantidad: number;
  peso: number;
  source: EntradaSource;
  date: string;
}

async function agregarEntrada(entrada: Entrada) {
  try {
    const response = await fetch('/api/inventory/add-entrada', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(entrada),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Error adding entrada');
    }

    const result = await response.json();
    console.log('Success adding entrada:', result);
    return true;
  } catch (error) {
    console.error('Error adding entrada:', error);
    return false;
  }
}

const TOTAL_LINEAS = 20; // Puedes ajustar este número para cambiar el total de líneas
const GROSOR_LINEA = 2; // Puedes ajustar este número para cambiar el grosor de las líneas

const obtenerColorCategoria = (categoria: string) => {
  const categoriaLower = categoria.toLowerCase();
  switch (categoriaLower) {
    case 'producto terminado':
      return 'bg-emerald-100 text-emerald-800'
    case 'chile':
      return 'bg-red-100 text-red-800'
    case 'costal':
      return 'bg-amber-100 text-amber-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

const obtenerColorEstado = (estado: string) => {
  switch (estado.toLowerCase()) {
    case 'en stock':
      return 'bg-green-100 text-green-800'
    case 'bajo stock':
      return 'bg-yellow-100 text-yellow-800'
    case 'sin stock':
      return 'bg-red-100 text-red-800'
    case 'sobrestock':
      return 'bg-blue-100 text-blue-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

function TarjetaInventario({ articulo }: { articulo: Articulo }) {
  const [estaAbierto, setEstaAbierto] = useState(false)

  return (
    <Dialog open={estaAbierto} onOpenChange={setEstaAbierto}>
      <DialogTrigger asChild>
        <Card 
          className="w-full bg-gray-50 shadow-sm hover:shadow-md transition-shadow cursor-pointer relative"
          onClick={() => setEstaAbierto(true)}
        >
          <CardHeader className="pb-2">
            <p className="text-sm text-gray-700">{articulo.nombre}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <h3 className="text-lg font-semibold">${articulo.precio.toFixed(2)}</h3>
            <div className="flex items-center justify-between text-sm text-gray-500">
              <div className="flex items-center">
                <Package className="mr-1 h-4 w-4" />
                <span>{articulo.cantidad}</span>
                {articulo.categoria.toLowerCase() === 'costal' && (
                  <span className="ml-2 text-amber-600 font-medium">
                    ({articulo.peso.toFixed(1)} kg)
                  </span>
                )}
              </div>
              <div className="flex items-center">
                <span>{articulo.ultimaActualizacion}</span>
                <ChevronRight className="ml-1 h-4 w-4" />
              </div>
            </div>
          </CardContent>
          <Badge 
            variant="secondary" 
            className={`absolute top-2 right-2 ${obtenerColorCategoria(articulo.categoria)}`}
          >
            {articulo.categoria}
          </Badge>
        </Card>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Detalles de {articulo.nombre}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p><strong>Categoría:</strong> {articulo.categoria}</p>
          <p><strong>Precio:</strong> ${articulo.precio.toFixed(2)}</p>
          <p><strong>Cantidad:</strong> {articulo.cantidad}</p>
          {articulo.categoria.toLowerCase() === 'costal' && (
            <p><strong>Peso Total:</strong> {articulo.peso.toFixed(1)} kg</p>
          )}
          <p><strong>Última Actualización:</strong> {articulo.ultimaActualizacion}</p>
          <p><strong>Estado:</strong> {articulo.estado}</p>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function TablaInventario({ articulos }: { articulos: Articulo[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-gray-100">
          <TableHead className="rounded-tl-lg">
            <div className="flex items-center">
              <Box className="mr-2 h-4 w-4" />
              Nombre
            </div>
          </TableHead>
          <TableHead>
            <div className="flex items-center">
              <Tag className="mr-2 h-4 w-4" />
              Categoría
            </div>
          </TableHead>
          <TableHead>
            <div className="flex items-center">
              <DollarSign className="mr-2 h-4 w-4" />
              Precio
            </div>
          </TableHead>
          <TableHead>
            <div className="flex items-center">
              <Package className="mr-2 h-4 w-4" />
              Cantidad
            </div>
          </TableHead>
          <TableHead>
            <div className="flex items-center">
              <AlertCircle className="mr-2 h-4 w-4" />
              Estado
            </div>
          </TableHead>
          <TableHead className="rounded-tr-lg">
            <div className="flex items-center">
              <Clock className="mr-2 h-4 w-4" />
              Última Actualización
            </div>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {articulos.map((articulo) => (
          <TableRow key={articulo.id}>
            <TableCell>{articulo.nombre}</TableCell>
            <TableCell>
              <Badge 
                variant="secondary" 
                className={obtenerColorCategoria(articulo.categoria)}
              >
                {articulo.categoria}
              </Badge>
            </TableCell>
            <TableCell>${articulo.precio.toFixed(2)}</TableCell>
            <TableCell>
              {articulo.cantidad}
              {articulo.categoria.toLowerCase() === 'costal' && (
                <span className="ml-2 text-amber-600">
                  ({articulo.peso.toFixed(1)} kg)
                </span>
              )}
            </TableCell>
            <TableCell>
              <Badge 
                variant="secondary" 
                className={obtenerColorEstado(articulo.estado)}
              >
                {articulo.estado}
              </Badge>
            </TableCell>
            <TableCell>{articulo.ultimaActualizacion}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

interface ProductEntry {
  productId: string;
  cantidad: string;
  peso: string;
  source: EntradaSource;
  date?: string;
}

// Add this new component for the searchable select
function SearchableSelect({ 
  id, 
  value, 
  onChange, 
  options, 
  placeholder = "Seleccionar producto" 
}: { 
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: Articulo[];
  placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  // Filter options based on search term
  const filteredOptions = options.filter(option => 
    option.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative col-span-3">
      <div
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        {value ? options.find(o => o.id.toString() === value)?.nombre : placeholder}
      </div>
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg">
          <Input
            className="border-0 border-b rounded-t-md rounded-b-none focus:ring-0"
            placeholder="Buscar producto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onClick={(e) => e.stopPropagation()}
          />
          <div className="max-h-[200px] overflow-y-auto">
            {filteredOptions.map((option) => (
              <div
                key={option.id}
                className={`px-3 py-2 cursor-pointer hover:bg-accent ${
                  value === option.id.toString() ? 'bg-accent' : ''
                }`}
                onClick={() => {
                  onChange(option.id.toString());
                  setIsOpen(false);
                  setSearchTerm("");
                }}
              >
                {option.nombre}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DialogoAgregarEntrada({ 
  estaAbierto, 
  setEstaAbierto, 
  articulos, 
  alGuardar 
}: ModalInventarioProps): JSX.Element {
  const [entries, setEntries] = useState<(ProductEntry & { source: EntradaSource })[]>([{ 
    productId: '', 
    cantidad: '', 
    peso: '',
    source: 'Produccion'  // Default value
  }]);
  const [error, setError] = useState<string | null>(null);

  const addNewEntry = () => {
    setEntries([...entries, { productId: '', cantidad: '', peso: '', source: 'Produccion' }]);
  };

  const updateEntry = (index: number, field: keyof (ProductEntry & { source: EntradaSource }), value: string) => {
    const newEntries = [...entries];
    newEntries[index] = { ...newEntries[index], [field]: value };
    setEntries(newEntries);
  };

  const handleSubmit = async () => {
    const cantidades: Cantidades = {};
    
    try {
      for (const entry of entries) {
        if (entry.productId && entry.cantidad) {
          const producto = articulos.find(p => p.id === parseInt(entry.productId));
          if (producto) {
            const entrada: Entrada = {
              nombre: producto.nombre,
              categoria: producto.categoria,
              cantidad: parseInt(entry.cantidad),
              peso: producto.categoria.toLowerCase() === 'costal' ? parseFloat(entry.peso) || 0 : 0,
              source: entry.source,
              date: new Date().toISOString().split('T')[0]
            };

            // Add the deduction logic for Molido, Habanero, and ENT products
            if (
              (producto.nombre === 'Chiltepin Molido 50 g' || producto.nombre === '20g') ||
              (producto.nombre === 'Hab50g' || producto.nombre === 'Hab20g') ||
              (producto.nombre === 'E30g' || producto.nombre === 'Molinillo' || 
               producto.nombre === 'Tira E' || producto.nombre === 'Bt 500 gr ent' || 
               producto.nombre === 'Ba 500 gr ent')
            ) {
              // Determine which costal to deduct from
              let costalName = 'Costal MOL';
              if (producto.nombre.includes('Hab')) {
                costalName = 'Costal Hab';
              } else if (['E30g', 'Molinillo', 'Tira E', 'Bt 500 gr ent', 'Ba 500 gr ent'].includes(producto.nombre)) {
                costalName = 'Costal ENT';
              }
              
              const costal = articulos.find(p => p.nombre === costalName);
              
              if (costal) {
                let deduction = 0;
                
                // Calculate weight deduction based on product
                if (producto.nombre === 'Chiltepin Molido 50 g' || producto.nombre === 'Hab50g') {
                  deduction = 0.05 * Math.abs(parseInt(entry.cantidad));  // 50g = 0.05kg
                } else if (producto.nombre === '20g' || producto.nombre === 'Hab20g') {
                  deduction = 0.02 * Math.abs(parseInt(entry.cantidad));  // 20g = 0.02kg
                } else if (['E30g', 'Molinillo', 'Tira E'].includes(producto.nombre)) {
                  deduction = 0.03 * Math.abs(parseInt(entry.cantidad));  // 30g = 0.03kg
                } else if (['Bt 500 gr ent', 'Ba 500 gr ent'].includes(producto.nombre)) {
                  deduction = 0.5 * Math.abs(parseInt(entry.cantidad));   // 500g = 0.5kg
                }

                // Create deduction entry for the corresponding costal
                const costalDeduction: Entrada = {
                  nombre: costalName,
                  categoria: 'Costal',
                  cantidad: 0,
                  peso: -deduction,
                  source: '',
                  date: new Date().toISOString().split('T')[0]
                };

                // Send the costal deduction to the API
                await fetch('/api/inventory/add-entrada', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(costalDeduction),
                });
              }
            }

            const success = await agregarEntrada(entrada);
            if (!success) {
              setError('Error adding entrada');
              return;
            }
          }
        }
      }
      
      // Reset and close after successful entries
      alGuardar(cantidades);
      setEntries([{ productId: '', cantidad: '', peso: '', source: 'Produccion' }]);
      setError(null);
      setEstaAbierto(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al agregar entrada');
    }
  };

  return (
    <Dialog open={estaAbierto} onOpenChange={setEstaAbierto}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Agregar Entrada de Inventario</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {entries.map((entry, index) => {
            const selectedProduct = articulos.find(a => a.id.toString() === entry.productId);
            const showPesoInput = selectedProduct?.categoria.toLowerCase() === 'costal';
            
            return (
              <div key={index} className="space-y-4 pb-4 border-b">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor={`producto-${index}`} className="text-right">
                    Producto
                  </Label>
                  <SearchableSelect
                    id={`producto-${index}`}
                    value={entry.productId}
                    onChange={(value) => updateEntry(index, 'productId', value)}
                    options={articulos}
                  />
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor={`cantidad-${index}`} className="text-right">
                    Cantidad
                  </Label>
                  <Input
                    id={`cantidad-${index}`}
                    type="number"
                    className="col-span-3"
                    value={entry.cantidad}
                    onChange={(e) => updateEntry(index, 'cantidad', e.target.value)}
                  />
                </div>

                {showPesoInput && (
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor={`peso-${index}`} className="text-right">
                      Peso (kg)
                    </Label>
                    <Input
                      id={`peso-${index}`}
                      type="number"
                      className="col-span-3"
                      value={entry.peso}
                      onChange={(e) => updateEntry(index, 'peso', e.target.value)}
                    />
                  </div>
                )}

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor={`source-${index}`} className="text-right">
                    Origen
                  </Label>
                  <select
                    id={`source-${index}`}
                    className="col-span-3 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                    value={entry.source}
                    onChange={(e) => updateEntry(index, 'source', e.target.value as EntradaSource)}
                  >
                    <option value="Produccion">Producción</option>
                    <option value="Inventario Inicial">Inventario Inicial</option>
                    <option value="Retorno de vendedor">Retorno de vendedor</option>
                  </select>
                </div>
              </div>
            );
          })}
          
          <Button 
            type="button" 
            variant="outline" 
            onClick={addNewEntry}
            className="mt-2"
          >
            <Plus className="h-4 w-4 mr-2" />
            Añadir más productos
          </Button>
        </div>
        <DialogFooter>
          <Button 
            type="submit" 
            onClick={handleSubmit} 
            className="rounded-full"
            disabled={!entries.some(e => e.productId && e.cantidad && 
              (!articulos.find(a => a.id.toString() === e.productId)?.categoria.toLowerCase().includes('costal') || e.peso)
            )}
          >
            Guardar entradas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DialogoNuevaSalida({ 
  estaAbierto, 
  setEstaAbierto, 
  articulos, 
  alGuardar 
}: ModalInventarioProps): JSX.Element {
  const [entries, setEntries] = useState<ProductEntry[]>([{ 
    productId: '', 
    cantidad: '', 
    peso: '',
    source: ''  // Add this
  }]);
  const [error, setError] = useState<string | null>(null);

  const addNewEntry = () => {
    setEntries([...entries, { 
      productId: '', 
      cantidad: '', 
      peso: '', 
      source: ''  // Add this
    }]);
  };

  const updateEntry = (index: number, field: keyof ProductEntry, value: string) => {
    const newEntries = [...entries];
    newEntries[index] = { ...newEntries[index], [field]: value };
    setEntries(newEntries);
  };

  const handleSubmit = async () => {
    const cantidades: Cantidades = {};
    
    try {
      for (const entry of entries) {
        if (entry.productId && entry.cantidad) {
          const producto = articulos.find(p => p.id === parseInt(entry.productId));
          if (producto) {
            const salida: Entrada = {
              nombre: producto.nombre,
              categoria: producto.categoria,
              cantidad: -Math.abs(parseInt(entry.cantidad)),
              peso: producto.categoria.toLowerCase() === 'costal' ? parseFloat(entry.peso) || 0 : 0,
              source: '',
              date: new Date().toISOString().split('T')[0]
            };

            const response = await fetch('/api/inventory/add-entrada', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(salida),
            });

            const data = await response.json();

            if (!response.ok) {
              throw new Error(data.error || 'Error adding salida');
            }

            if (!data.success) {
              throw new Error(data.error || 'Failed to add salida');
            }
          }
        }
      }
      
      // Reset and close after successful subtractions
      alGuardar(cantidades);
      setEntries([{ productId: '', cantidad: '', peso: '', source: '' }]);
      setError(null);
      setEstaAbierto(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al agregar salida');
    }
  };

  return (
    <Dialog open={estaAbierto} onOpenChange={setEstaAbierto}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Nueva Salida de Inventario</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {entries.map((entry, index) => {
            const selectedProduct = articulos.find(a => a.id.toString() === entry.productId);
            const showPesoInput = selectedProduct?.categoria.toLowerCase() === 'costal';
            
            return (
              <div key={index} className="space-y-4 pb-4 border-b">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor={`producto-${index}`} className="text-right">
                    Producto
                  </Label>
                  <SearchableSelect
                    id={`producto-${index}`}
                    value={entry.productId}
                    onChange={(value) => updateEntry(index, 'productId', value)}
                    options={articulos}
                  />
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor={`cantidad-${index}`} className="text-right">
                    Cantidad
                  </Label>
                  <Input
                    id={`cantidad-${index}`}
                    type="number"
                    className="col-span-3"
                    value={entry.cantidad}
                    onChange={(e) => updateEntry(index, 'cantidad', e.target.value)}
                    max={selectedProduct?.cantidad || 0}
                  />
                </div>

                {showPesoInput && (
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor={`peso-${index}`} className="text-right">
                      Peso (kg)
                    </Label>
                    <Input
                      id={`peso-${index}`}
                      type="number"
                      className="col-span-3"
                      value={entry.peso}
                      onChange={(e) => updateEntry(index, 'peso', e.target.value)}
                    />
                  </div>
                )}
              </div>
            );
          })}
          
          <Button 
            type="button" 
            variant="outline" 
            onClick={addNewEntry}
            className="mt-2"
          >
            <Plus className="h-4 w-4 mr-2" />
            Añadir más productos
          </Button>
        </div>
        <DialogFooter>
          <Button 
            type="submit" 
            onClick={handleSubmit} 
            className="rounded-full bg-red-600 hover:bg-red-700"
            disabled={!entries.some(e => e.productId && e.cantidad && 
              (!articulos.find(a => a.id.toString() === e.productId)?.categoria.toLowerCase().includes('costal') || e.peso)
            )}
          >
            Guardar salidas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// First, let's add these constants at the top of the file after the interfaces
const STOCK_THRESHOLDS = {
  LOW: 5,
  HIGH: 100
};

const TOTAL_BARS = 20;

function InventoryBarChart({ articulos }: { articulos: Articulo[] }) {
  const data = articulos
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 12)
    .map(articulo => ({
      name: articulo.nombre,
      cantidad: articulo.cantidad,
      peso: articulo.categoria.toLowerCase() === 'costal' ? articulo.peso : 0
    }));

  const chartConfig = {
    cantidad: {
      label: "Cantidad",
      color: "hsl(210, 100%, 85%)", // Light blue color
    },
    peso: {
      label: "Peso (kg)",
      color: "hsl(210, 100%, 75%)", // Slightly darker light blue
    },
    label: {
      color: "hsl(var(--background))",
    },
  } satisfies ChartConfig;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inventario Actual</CardTitle>
        <CardDescription>Top 12 Productos</CardDescription>
      </CardHeader>
      <CardContent className="h-[320px]">
        <ChartContainer config={chartConfig} className="h-[280px] max-w-full">
          <RechartsBarChart
            accessibilityLayer
            data={data}
            layout="vertical"
            margin={{
              right: 45,
              left: 16,
              top: 5,
              bottom: 5
            }}
            barSize={16}
            maxBarSize={200}
          >
            <CartesianGrid horizontal={false} />
            <RechartsYAxis
              dataKey="name"
              type="category"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              hide
              width={0}
            />
            <RechartsXAxis 
              dataKey="cantidad" 
              type="number" 
              domain={[0, 250]}
              hide 
            />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <RechartsBar
              dataKey="cantidad"
              layout="vertical"
              fill="#93C5FD"
              radius={4}
              minPointSize={2}
              maxBarSize={16}
            >
              <LabelList
                dataKey="name"
                position="insideLeft"
                offset={6}
                className="fill-[--color-label]"
                fontSize={10}
              />
            </RechartsBar>
          </RechartsBarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="leading-none text-muted-foreground">
          Mostrando los productos con mayor cantidad en inventario
        </div>
      </CardFooter>
    </Card>
  );
}

function InventoryAreaChart({ articulos }: { articulos: Articulo[] }) {
  const [chartData, setChartData] = useState<Array<{
    day: string;
    entradas: number;
    salidas: number;
  }>>([]);

  useEffect(() => {
    const fetchMovements = async () => {
      try {
        const tokenResponse = await fetch('/api/auth/token');
        const { access_token } = await tokenResponse.json();
        
        const response = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${process.env.NEXT_PUBLIC_SHEET_NAME3}!A2:F`,
          {
            headers: {
              'Authorization': `Bearer ${access_token}`,
            }
          }
        );

        if (!response.ok) throw new Error('Failed to fetch movements');
        const data = await response.json();
        
        // Process the last 7 days of data
        const movements = data.values || [];
        const dailyData = new Map<string, { entradas: number; salidas: number }>();
        
        // Get last 7 days
        const days = Array.from({length: 7}, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - i);
          return d;
        }).reverse();

        // Initialize all days with zero values
        days.forEach(day => {
          const dayKey = day.toLocaleDateString('es-ES', { weekday: 'short' });
          dailyData.set(dayKey, { entradas: 0, salidas: 0 });
        });
        
        movements.forEach((row: any[]) => {
          const cantidad = parseInt(row[2]) || 0;
          const date = new Date(row[5]); // Using the date column
          
          // Only process last 7 days
          const today = new Date();
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          
          if (date >= weekAgo && date <= today) {
            const dayKey = date.toLocaleDateString('es-ES', { weekday: 'short' });
            const current = dailyData.get(dayKey) || { entradas: 0, salidas: 0 };
            
            if (cantidad > 0) {
              current.entradas += cantidad;
            } else {
              current.salidas += Math.abs(cantidad);
            }
            
            dailyData.set(dayKey, current);
          }
        });

        const processedData = Array.from(dailyData.entries())
          .map(([day, data]) => ({
            day: day.charAt(0).toUpperCase() + day.slice(1),
            ...data
          }));

        setChartData(processedData);
      } catch (error) {
        console.error('Error fetching movement data:', error);
      }
    };

    fetchMovements();
  }, []);

  const chartConfig = {
    entradas: {
      label: "Entradas",
      color: "hsl(142, 76%, 36%)", // Green color
    },
    salidas: {
      label: "Salidas",
      color: "hsl(346, 87%, 43%)", // Red color
    },
  } satisfies ChartConfig;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Entradas vs Salidas</CardTitle>
        <CardDescription>Movimientos de la semana</CardDescription>
      </CardHeader>
      <CardContent className="h-[320px]">
        <ChartContainer config={chartConfig} className="h-[280px] max-w-full">
          <AreaChart
            accessibilityLayer
            data={chartData}
            margin={{
              left: 16,
              right: 45,
              top: 5,
              bottom: 5
            }}
          >
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#E5E7EB" />
            <RechartsXAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              stroke="#6B7280"
            />
            <RechartsYAxis
              type="number"
              domain={[0, 250]}  // Add fixed domain
              hide
            />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <defs>
              <linearGradient id="fillEntradas" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#059669" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#059669" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="fillSalidas" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#E11D48" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#E11D48" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <Area
              dataKey="salidas"
              type="monotone"
              fill="url(#fillSalidas)"
              fillOpacity={1}
              stroke="#E11D48"
              strokeWidth={2}
            />
            <Area
              dataKey="entradas"
              type="monotone"
              fill="url(#fillEntradas)"
              fillOpacity={1}
              stroke="#059669"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
      <CardFooter>
        <div className="flex w-full items-start gap-2 text-sm">
          <div className="grid gap-2">
            <div className="flex items-center gap-2 font-medium leading-none">
              {chartData.length > 0 && (
                <>
                  {chartData[chartData.length - 1].entradas > chartData[chartData.length - 1].salidas ? (
                    <>Más entradas que salidas hoy <TrendingUp className="h-4 w-4 text-green-500" /></>
                  ) : (
                    <>Más salidas que entradas hoy <TrendingUp className="h-4 w-4 text-amber-500 rotate-180" /></>
                  )}
                </>
              )}
            </div>
            <div className="flex items-center gap-2 leading-none text-muted-foreground">
              Últimos 7 días
            </div>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}

// Helper function to get week number
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

export function PanelDeInventarioComponent() {
  const [terminoBusqueda, setTerminoBusqueda] = useState("")
  const [esVistaTargeta, setEsVistaTargeta] = useState(true)
  const [estaAgregarEntradaAbierto, setEstaAgregarEntradaAbierto] = useState(false)
  const [estaNuevaSalidaAbierto, setEstaNuevaSalidaAbierto] = useState(false)
  const [articulos, setArticulos] = useState<Articulo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const loadInventario = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const productos = await fetchProductos();
        const cantidades = await fetchEntradas();

        const inventarioActualizado = productos.map(producto => {
          const cantidadInfo = cantidades[producto.nombre] || { cantidad: 0, peso: 0 };
          let estado = 'Sin Stock';
          if (cantidadInfo.cantidad > 0) {
            estado = cantidadInfo.cantidad <= 5 ? 'Bajo Stock' : cantidadInfo.cantidad > 100 ? 'Sobrestock' : 'En Stock';
          }

          return {
            ...producto,
            cantidad: cantidadInfo.cantidad,
            peso: cantidadInfo.peso,
            estado,
            ultimaActualizacion: '0d'
          };
        });

        setArticulos(inventarioActualizado);
      } catch (err) {
        console.error('Error in loadInventario:', err);
        setError(err instanceof Error ? err.message : 'Error loading inventory');
      } finally {
        setIsLoading(false);
      }
    };

    loadInventario();
  }, []);

  const articulosFiltrados = articulos.filter(articulo =>
    articulo.nombre.toLowerCase().includes(terminoBusqueda.toLowerCase()) ||
    articulo.categoria.toLowerCase().includes(terminoBusqueda.toLowerCase())
  )

  const manejarAgregarEntrada = async (nuevasCantidades: Cantidades) => {
    try {
      for (const [productoId, cantidad] of Object.entries(nuevasCantidades)) {
        if (cantidad > 0) {
          const producto = articulos.find(p => p.id === parseInt(productoId));
          if (producto) {
            const entrada: Entrada = {
              nombre: producto.nombre,
              categoria: producto.categoria,
              cantidad: Number(cantidad),
              peso: producto.categoria.toLowerCase() === 'costal' ? parseFloat(producto.peso.toString()) || 0 : 0
            };

            const response = await fetch('/api/inventory/add-entrada', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(entrada),
            });

            const data = await response.json();

            if (!response.ok) {
              throw new Error(data.error || 'Error adding entrada');
            }

            if (!data.success) {
              throw new Error(data.error || 'Failed to add entrada');
            }
          }
        }
      }

      // Reload inventory after successful additions
      const productos = await fetchProductos();
      const cantidades = await fetchEntradas();
      
      const inventarioActualizado = productos.map(producto => {
        const cantidadInfo = cantidades[producto.nombre] || { cantidad: 0, peso: 0 };
        let estado = 'Sin Stock';
        if (cantidadInfo.cantidad > 0) {
          estado = cantidadInfo.cantidad <= 5 ? 'Bajo Stock' : cantidadInfo.cantidad > 100 ? 'Sobrestock' : 'En Stock';
        }

        return {
          ...producto,
          cantidad: cantidadInfo.cantidad,
          peso: cantidadInfo.peso,
          estado,
          ultimaActualizacion: '0d'
        };
      });

      setArticulos(inventarioActualizado);
      setEstaAgregarEntradaAbierto(false);
    } catch (error) {
      console.error('Error in manejarAgregarEntrada:', error);
      setError(error instanceof Error ? error.message : 'Error adding entrada');
    }
  };

  const manejarNuevaSalida = async (nuevasCantidades: Cantidades) => {
    try {
      for (const [productoId, cantidad] of Object.entries(nuevasCantidades)) {
        if (cantidad < 0) {
          const producto = articulos.find(p => p.id === parseInt(productoId));
          if (producto) {
            const salida: Entrada = {
              nombre: producto.nombre,
              categoria: producto.categoria,
              cantidad: -Math.abs(cantidad),
              peso: producto.categoria.toLowerCase() === 'costal' ? parseFloat(producto.peso.toString()) || 0 : 0,
              source: '',
              date: new Date().toISOString().split('T')[0]
            };

            // Add the deduction logic for Molido, Habanero, and ENT products
            if (
              (producto.nombre === 'Chiltepin Molido 50 g' || producto.nombre === '20g') ||
              (producto.nombre === 'Hab50g' || producto.nombre === 'Hab20g') ||
              (producto.nombre === 'E30g' || producto.nombre === 'Molinillo' || 
               producto.nombre === 'Tira E' || producto.nombre === 'Bt 500 gr ent' || 
               producto.nombre === 'Ba 500 gr ent')
            ) {
              // Determine which costal to deduct from
              let costalName = 'Costal MOL';
              if (producto.nombre.includes('Hab')) {
                costalName = 'Costal Hab';
              } else if (['E30g', 'Molinillo', 'Tira E', 'Bt 500 gr ent', 'Ba 500 gr ent'].includes(producto.nombre)) {
                costalName = 'Costal ENT';
              }
              
              const costal = articulos.find(p => p.nombre === costalName);
              
              if (costal) {
                let deduction = 0;
                
                // Calculate weight deduction based on product
                if (producto.nombre === 'Chiltepin Molido 50 g' || producto.nombre === 'Hab50g') {
                  deduction = 0.05 * Math.abs(cantidad);  // 50g = 0.05kg
                } else if (producto.nombre === '20g' || producto.nombre === 'Hab20g') {
                  deduction = 0.02 * Math.abs(cantidad);  // 20g = 0.02kg
                } else if (['E30g', 'Molinillo', 'Tira E'].includes(producto.nombre)) {
                  deduction = 0.03 * Math.abs(cantidad);  // 30g = 0.03kg
                } else if (['Bt 500 gr ent', 'Ba 500 gr ent'].includes(producto.nombre)) {
                  deduction = 0.5 * Math.abs(cantidad);   // 500g = 0.5kg
                }

                // Create deduction entry for the corresponding costal
                const costalDeduction: Entrada = {
                  nombre: costalName,
                  categoria: 'Costal',
                  cantidad: 0,
                  peso: -deduction,
                  source: '',
                  date: new Date().toISOString().split('T')[0]
                };

                // Send the costal deduction to the API
                await fetch('/api/inventory/add-entrada', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(costalDeduction),
                });
              }
            }

            // Send the original salida
            const response = await fetch('/api/inventory/add-entrada', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(salida),
            });

            const data = await response.json();

            if (!response.ok) {
              throw new Error(data.error || 'Error adding salida');
            }

            if (!data.success) {
              throw new Error(data.error || 'Failed to add salida');
            }
          }
        }
      }

      // Reload inventory after successful subtractions
      const productos = await fetchProductos();
      const cantidades = await fetchEntradas();
      
      const inventarioActualizado = productos.map(producto => {
        const cantidadInfo = cantidades[producto.nombre] || { cantidad: 0, peso: 0 };
        let estado = 'Sin Stock';
        if (cantidadInfo.cantidad > 0) {
          estado = cantidadInfo.cantidad <= 5 ? 'Bajo Stock' : cantidadInfo.cantidad > 100 ? 'Sobrestock' : 'En Stock';
        }

        return {
          ...producto,
          cantidad: cantidadInfo.cantidad,
          peso: cantidadInfo.peso,
          estado,
          ultimaActualizacion: '0d',
          source: '',
          date: new Date().toISOString().split('T')[0]
        };
      });

      setArticulos(inventarioActualizado);
      setEstaNuevaSalidaAbierto(false);
    } catch (error) {
      console.error('Error in manejarNuevaSalida:', error);
      setError(error instanceof Error ? error.message : 'Error adding salida');
    }
  };

  const valorTotalActivos = articulos.reduce((suma, articulo) => suma + (articulo.precio * articulo.cantidad), 0)
  const conteoEnStock = articulos.filter(a => a.estado === "En Stock").length
  const conteoBajoStock = articulos.filter(a => a.estado === "Bajo Stock").length
  const conteoSinStock = articulos.filter(a => a.estado === "Sin Stock").length

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center font-inter">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center text-red-600 font-inter">
        {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background font-inter">
      <div className="border-b">
        <header className="flex items-center justify-between px-6 lg:px-0 py-4 max-w-6xl mx-auto w-full">
          <div className="flex items-center">
            <h1 className="text-4xl font-medium tracking-tighter">Mi Inventario</h1>
          </div>
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="icon" className="rounded-full">
              <Bell className="h-6 w-6" />
              <span className="sr-only">Notificaciones</span>
            </Button>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Settings className="h-6 w-6" />
              <span className="sr-only">Configuración</span>
            </Button>
            <div className="relative">
              <button
                className="p-1 rounded-full hover:bg-gray-200 transition-colors duration-200"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
              >
                <Menu className="h-5 w-5 text-gray-600" />
              </button>
              {isMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
                  <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
                    <Link
                      href="/"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      role="menuitem"
                    >
                      Dashboard
                    </Link>
                    <Link
                      href="/admin"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      role="menuitem"
                    >
                      Admin
                    </Link>
                    <Link
                      href="/form"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      role="menuitem"
                    >
                      Form
                    </Link>
                    <Link
                      href="/rutas"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      role="menuitem"
                    >
                      Rutas
                    </Link>
                    <Link
                      href="/inventario"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      role="menuitem"
                    >
                      Inventario
                    </Link>
                  </div>
                </div>
              )}
            </div>
            <Avatar>
              <AvatarImage src="/placeholder.svg?height=32&width=32" alt="Usuario" />
              <AvatarFallback>U</AvatarFallback>
            </Avatar>
          </div>
        </header>
      </div>

      <div className="border-b">
        <div className="px-6 lg:px-0 py-6 max-w-6xl mx-auto w-full">
          <div className="flex items-start space-x-6">
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground uppercase flex items-center gap-1">
                <DollarSign className="h-4 w-4" />
                VALOR TOTAL DE ACTIVOS
              </div>
              <div className="text-3xl font-bold">
                ${valorTotalActivos.toLocaleString()}
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-3xl font-bold">{articulos.length}</span>
                <span className="text-sm text-muted-foreground">productos</span>
              </div>
              <div className="flex gap-1 h-8 items-center">
                {Array.from({ length: TOTAL_BARS }).map((_, index) => {
                  // Calculate percentages for different stock levels
                  const sinStock = (conteoSinStock / articulos.length) * TOTAL_BARS;
                  const bajoStock = (conteoBajoStock / articulos.length) * TOTAL_BARS;
                  const sobreStock = (articulos.filter(a => a.cantidad > STOCK_THRESHOLDS.HIGH).length / articulos.length) * TOTAL_BARS;
                  
                  let barColor;
                  if (index < sinStock) {
                    barColor = 'bg-red-500';
                  } else if (index < sinStock + bajoStock) {
                    barColor = 'bg-yellow-500';
                  } else if (index > TOTAL_BARS - sobreStock) {
                    barColor = 'bg-blue-500';
                  } else {
                    barColor = 'bg-green-500';
                  }

                  return (
                    <div
                      key={index}
                      className={`w-1.5 h-8 rounded-full ${barColor}`}
                      title={`Barra ${index + 1} de ${TOTAL_BARS}`}
                    />
                  );
                })}
              </div>
              <div className="flex items-center gap-4 text-sm mt-2">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-2 rounded-full bg-green-500" />
                  <span className="text-muted-foreground">
                    <span className="hidden sm:inline">En stock: </span>{conteoEnStock}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-4 w-2 rounded-full bg-yellow-500" />
                  <span className="text-muted-foreground">
                    <span className="hidden sm:inline">Bajo stock: </span>{conteoBajoStock}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-4 w-2 rounded-full bg-red-500" />
                  <span className="text-muted-foreground">
                    <span className="hidden sm:inline">Sin stock: </span>{conteoSinStock}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-4 w-2 rounded-full bg-blue-500" />
                  <span className="text-muted-foreground">
                    <span className="hidden sm:inline">Sobrestock: </span>
                    {articulos.filter(a => a.cantidad > STOCK_THRESHOLDS.HIGH).length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="flex-1 px-6 lg:px-0 py-6">
        <div className="max-w-6xl mx-auto space-y-6 w-full">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InventoryBarChart articulos={articulos} />
            <InventoryAreaChart articulos={articulos} />
          </div>
          
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar inventario..."
                  value={terminoBusqueda}
                  onChange={(e) => setTerminoBusqueda(e.target.value)}
                  className="pl-8 rounded-full"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                onClick={() => setEsVistaTargeta(!esVistaTargeta)}
                aria-label={esVistaTargeta ? "Cambiar a vista de tabla" : "Cambiar a vista de tarjetas"}
              >
                {esVistaTargeta ? <TableIcon className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
              </Button>
            </div>
            <div className="flex items-center gap-4">
              <Button
                onClick={() => setEstaAgregarEntradaAbierto(true)}
                className="bg-black text-white hover:bg-black/90 px-4 py-3 rounded-full h-auto"
              >
                <Plus className="h-4 w-4 mr-2" />
                Entrada
              </Button>
              <Button
                onClick={() => setEstaNuevaSalidaAbierto(true)}
                variant="outline"
                className="bg-gray-100 hover:bg-gray-200 border-0 px-4 py-3 rounded-full h-auto"
              >
                <Minus className="h-4 w-4 mr-2" />
                Salida
              </Button>
            </div>
          </div>

          {esVistaTargeta ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {articulosFiltrados.map((articulo) => (
                <TarjetaInventario key={articulo.id} articulo={articulo} />
              ))}
            </div>
          ) : (
            <TablaInventario articulos={articulosFiltrados} />
          )}
        </div>
      </main>

      <DialogoAgregarEntrada 
        estaAbierto={estaAgregarEntradaAbierto}
        setEstaAbierto={setEstaAgregarEntradaAbierto}
        articulos={articulos}
        alGuardar={manejarAgregarEntrada}
      />
      <DialogoNuevaSalida 
        estaAbierto={estaNuevaSalidaAbierto}
        setEstaAbierto={setEstaNuevaSalidaAbierto}
        articulos={articulos}
        alGuardar={manejarNuevaSalida}
      />
    </div>
  )
}