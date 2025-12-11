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
					// Usa la foto de Google o el /favicon.svg vacío.
					const photoUrl = p.photoURL || "/favicon.svg";
					const baseClass = p.isNearby
						? "border-emerald-600"
						: "border-sky-500";

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
							// El Popup fue eliminado para priorizar el hover
						></Marker>
					);
				}
				return null;
			})}

			{/* Marcador de ubicación del visor ELIMINADO */}
		</MapContainer>
	);
};
