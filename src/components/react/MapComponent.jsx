import React, { useEffect, useRef, useMemo } from "react";
import {
	MapContainer,
	TileLayer,
	Marker,
	Popup,
	useMap,
	useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapPin } from "lucide-react";

// 🚨 CRÍTICO: Inicialización de iconos de Leaflet (solo si window existe)
if (typeof window !== "undefined") {
	delete L.Icon.Default.prototype._get;
	L.Icon.Default.mergeOptions({
		iconRetinaUrl: "/marker-icon-2x.png",
		iconUrl: "/marker-icon.png",
		shadowUrl: "/marker-shadow.png",
	});
}

// CONSTANTES
const DEFAULT_CENTER = [20, 0];
const DEFAULT_ZOOM = 2;
const ZOOM_LEVEL_CITY_THRESHOLD = 4; // Umbral para cambiar de País a Ciudad/Pueblo

// Fallback SVG para el marcador cuando no hay foto de perfil
const DEFAULT_AVATAR_MARKER = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cpath d='M12 8v4'/%3E%3Cpath d='M12 16h.01'/%3E%3C/svg%3E`;

// Componente para rastrear el zoom (para filtrar la ubicación)
const MapZoomTracker = ({ updateZoom }) => {
	const map = useMap();

	// Hook para rastrear el zoom y enviarlo al componente padre (Islands.jsx)
	useMapEvents({
		zoomend: () => {
			updateZoom(map.getZoom());
		},
		// Establecer el zoom inicial al montar
		load: () => {
			updateZoom(map.getZoom());
		},
	});

	return null;
};

// Componente principal del mapa (la Tierra)
export const MapComponent = ({
	messages,
	viewerLocation,
	nearbyThoughtExists,
	openProfile,
	updateZoom,
	currentMapZoom,
}) => {
	return (
		<MapContainer
			center={DEFAULT_CENTER}
			zoom={DEFAULT_ZOOM}
			scrollWheelZoom={true}
			minZoom={DEFAULT_ZOOM}
			style={{ height: "100%", width: "100%", zIndex: 0 }}
			className="map-container"
		>
			{/* Tiles Satelitales (Similar a Google Earth) */}
			<TileLayer
				attribution="Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
				url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
			/>

			{/* Rastreador de Zoom */}
			<MapZoomTracker updateZoom={updateZoom} />

			{/* Marcadores de Mensajes (Partículas) */}
			{messages.map((p) => {
				if (p.location) {
					const [lat, lon] = [p.location.lat, p.location.lon];

					// LÓGICA DE FILTRADO POR ZOOM
					const isCityZoom = currentMapZoom >= ZOOM_LEVEL_CITY_THRESHOLD;
					const displayLocation =
						isCityZoom && p.cityName
							? p.cityName
							: p.countryName || "Ubicación Desconocida";

					// Preparar datos para el marcador HTML
					// Usa la foto de Google o el SVG de reserva
					const photoUrl = p.photoURL || DEFAULT_AVATAR_MARKER;
					const baseClass = p.isNearby
						? "border-emerald-600"
						: "border-sky-500";
					const pulseClass = p.isNearby
						? "pulse-ring pulse-green-ring"
						: "pulse-blue-ring";

					// Limitar mensaje a 5 palabras para el overlay
					const messageSnippet = (
						p.text.split(" ").slice(0, 5).join(" ") + "..."
					).replace(/"/g, "&quot;");
					const locationText = displayLocation;

					// 1. Crear el HTML del contenido del marcador usando un string (L.divIcon)
					const markerHtml = `
						<div class="thought-marker-container">
							<div class="relative">
								<img src="${photoUrl}" alt="${p.displayName}" class="w-8 h-8 rounded-full object-cover border-2 ${baseClass}" />
								<span class="${pulseClass}"></span>
							</div>

							<div class="thought-message-overlay">
								<div class="message-bubble bg-zinc-900 border ${baseClass}/50 p-2 rounded-lg shadow-xl">
									<p class="text-white text-xs font-mono">"${messageSnippet}"</p>
									<span class="text-[9px] text-zinc-400 mt-1 block">${locationText}</span>
								</div>
							</div>
						</div>
					`;

					// Crear L.divIcon
					const markerIcon = L.divIcon({
						html: markerHtml,
						iconSize: [40, 40], // Tamaño del contenedor (ajustado para la imagen de 32px + padding)
						iconAnchor: [20, 20], // Ancla en el CENTRO de la imagen (20, 20)
						className: "transparent-marker-icon", // Clase para eliminar el fondo por defecto de Leaflet
					});

					return (
						<Marker
							key={p.id}
							position={[lat, lon]}
							icon={markerIcon}
							// No hay eventHandlers para que el clic simple abra el Popup.
						>
							<Popup>
								{/* Contenido del Pop-up con el tamaño ajustado */}
								<div className="text-black text-sm font-mono max-w-sm w-48 p-1">
									<div className="flex items-center gap-3 border-b pb-2 mb-2 border-zinc-200">
										<img
											src={p.photoURL || "/favicon.svg"}
											alt={p.displayName}
											className="w-10 h-10 rounded-full border border-zinc-400 object-cover"
										/>
										<div className="flex flex-col">
											<p className="text-xs font-bold text-zinc-800">
												{p.displayName?.split(" ")[0] || "Anónimo"}
											</p>
											<p className="text-[10px] text-zinc-500 uppercase tracking-widest">
												{p.category}
											</p>
										</div>
									</div>

									{/* Caja de Texto (Mensaje) */}
									<div className="bg-zinc-100 p-3 rounded text-zinc-700 border border-zinc-300/50">
										<p className="italic text-sm">"{p.text}"</p>
									</div>

									{/* Ubicación (Mostrar Ciudad o País) */}
									{p.countryName && (
										<div className="text-[10px] text-sky-600 mt-2 flex justify-end items-center gap-1">
											<MapPin size={10} /> {displayLocation}
										</div>
									)}

									{/* Botón para abrir el Modal de Perfil */}
									<button
										onClick={() => openProfile(p)}
										className="text-[10px] text-center text-emerald-600 mt-3 border-t pt-1 border-zinc-200 w-full hover:text-emerald-800 font-bold uppercase tracking-widest"
									>
										Ver Perfil Completo
									</button>
								</div>
							</Popup>
						</Marker>
					);
				}
				return null;
			})}

			{/* Marcador de ubicación del visor */}
			{viewerLocation && (
				<Marker
					position={[viewerLocation.lat, viewerLocation.lon]}
					icon={
						new L.Icon({
							iconUrl: "/target-user.svg",
							iconSize: [30, 30],
							iconAnchor: [15, 15],
							className: "user-marker",
						})
					}
				>
					<Popup>Estás aquí (Visor)</Popup>
				</Marker>
			)}
		</MapContainer>
	);
};
