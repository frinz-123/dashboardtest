import { useId, useRef, type ChangeEvent } from "react";

export type CleyPhotoPreview = {
    id: string;
    previewUrl: string;
    size: number;
};

interface CleyPhotoCaptureProps {
    photos: CleyPhotoPreview[];
    maxPhotos: number;
    minPhotos: number;
    isBusy: boolean;
    error?: string | null;
    onAddFiles: (files: FileList) => void;
    onRemove: (id: string) => void;
}

export default function CleyPhotoCapture({
    photos,
    maxPhotos,
    minPhotos,
    isBusy,
    error,
    onAddFiles,
    onRemove,
}: CleyPhotoCaptureProps) {
    const inputId = useId();
    const inputRef = useRef<HTMLInputElement | null>(null);
    const remaining = Math.max(0, maxPhotos - photos.length);
    const minRemaining = Math.max(0, minPhotos - photos.length);
    const isAtLimit = remaining === 0;

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files && files.length > 0) {
            onAddFiles(files);
        }
        if (inputRef.current) {
            inputRef.current.value = "";
        }
    };

    return (
        <fieldset className="space-y-3">
            <legend className="text-gray-700 font-semibold text-xs">
                Fotos (obligatorio)
            </legend>
            <div className="flex items-center justify-between text-xs text-gray-500">
                <span>
                    {photos.length}/{maxPhotos} fotos
                </span>
                <span>
                    {minRemaining > 0
                        ? `Faltan ${minRemaining} minimo`
                        : isAtLimit
                          ? "Listo"
                          : `Puedes agregar ${remaining}`}
                </span>
            </div>

            <label
                htmlFor={inputId}
                className={`inline-flex items-center gap-2 rounded-md border border-dashed border-gray-300 px-3 py-2 text-xs font-medium transition ${
                    isBusy || isAtLimit
                        ? "cursor-not-allowed opacity-60"
                        : "cursor-pointer hover:border-gray-400"
                }`}
            >
                <input
                    ref={inputRef}
                    id={inputId}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    disabled={isBusy || isAtLimit}
                    className="sr-only"
                    onChange={handleChange}
                />
                <span>{isAtLimit ? "Limite alcanzado" : "Agregar fotos"}</span>
            </label>

            {isBusy && (
                <p className="text-xs text-gray-500">Comprimiendo fotos...</p>
            )}
            {error && <p className="text-xs text-red-600">{error}</p>}
            {!error && photos.length === 0 && (
                <p className="text-xs text-gray-500">
                    Agrega de {minPhotos} a {maxPhotos} fotos.
                </p>
            )}

            {photos.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                    {photos.map((photo, index) => (
                        <div
                            key={photo.id}
                            className="relative overflow-hidden rounded-md border border-gray-200"
                        >
                            <img
                                src={photo.previewUrl}
                                alt={`Foto ${index + 1}`}
                                className="h-28 w-full object-cover"
                            />
                            <button
                                type="button"
                                className="absolute right-1 top-1 rounded-full bg-white/90 px-2 py-1 text-[10px] font-semibold text-gray-700 shadow hover:bg-white"
                                onClick={() => onRemove(photo.id)}
                            >
                                Quitar
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </fieldset>
    );
}
