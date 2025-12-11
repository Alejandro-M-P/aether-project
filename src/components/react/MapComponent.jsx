import React, { useState, useEffect, useRef, useMemo } from "react";
import Globe from "react-globe.gl";
import { MapPin, X } from "lucide-react";

// Texturas oscuras para el modo minimalista
const EARTH_NIGHT_TEXTURE = "//unpkg.com/three-globe/example/img/earth-night.jpg";
const EARTH_BUMP_TEXTURE = "//unpkg.com/three-globe/example/img/earth-topology.png";

export const MapComponent = ({ messages, openProfile }) => {
	const globeEl = useRef();
	const [selectedThought, setSelectedThought] = useState(null);
	const [dimensions, setDimensions] = useState({ width: 800, height: 800 });

	// Ajustar tamaño del globo a la ventana automáticamente
	useEffect(() => {
		const handleResize = () => {
			setDimensions({
				width: window.innerWidth,
				height: window.innerHeight
			});
		};
		// Ejecutar al inicio y al cambiar tamaño
		if (typeof window !== 'undefined') {
			window.addEventListener('resize', handleResize);
			handleResize();
		}
		return () => {
			if (typeof window !== 'undefined') window.removeEventListener('resize', handleResize);
		};
	}, []);

	// Configuración inicial: Auto-rotación y posición
	useEffect(() => {
		if (globeEl.current) {
			const controls = globeEl.current.controls();
			controls.autoRotate = true;
			controls.autoRotateSpeed = 0.5;
			// Zoom inicial (altitud)
			globeEl.current.pointOfView({ altitude: 2.5 });
		}
	}, []);

	// Filtramos solo mensajes con ubicación válida
	const validMessages = useMemo(() => {
		return messages.filter(m => m.location && m.location.lat && m.location.lon);
	}, [messages]);

	return (
		<div className="relative w-full h-full bg-black cursor-move">
			<Globe
				ref={globeEl}
				width={dimensions.width}
				height={dimensions.height}
				globeImageUrl={EARTH_NIGHT_TEXTURE}
				bumpImageUrl={EARTH_BUMP_TEXTURE}
				backgroundColor="#000000" // Fondo negro absoluto
				atmosphereColor="#4ade80" // Verde Aether sutil
				atmosphereAltitude={0.15}
				
				// --- MARCADORES (Puntos de luz) ---
				htmlElementsData={validMessages}
				htmlLat={d => d.location.lat}
				htmlLng={d => d.location.lon}
				htmlAltitude={0.01}
				htmlElement={d => {
					const el = document.createElement('div');
					// Punto pulsante simple
					const colorClass = d.isNearby ? 'bg-emerald-500' : 'bg-blue-500';
					const shadowClass = d.isNearby ? 'shadow-[0_0_10px_#10b981]' : 'shadow-[0_0_10px_#3b82f6]';
					
					el.innerHTML = `
						<div class="relative group cursor-pointer" style="transform: translate(-50%, -50%);">
							<div class="w-2 h-2 ${colorClass} rounded-full ${shadowClass} animate-pulse"></div>
							<div class="absolute -inset-2 rounded-full border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
						</div>
					`;
					
					el.onclick = () => {
						setSelectedThought(d);
						// Detener rotación al interactuar
						if (globeEl.current) globeEl.current.controls().autoRotate = false;
					};
					return el;
				}}
			/>

			{/* --- POPUP MINIMALISTA NEGRO --- */}
			{selectedThought && (
				<div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 animate-in zoom-in duration-200 pointer-events-none">
					{/* pointer-events-auto para que los botones dentro funcionen */}
					<div className="bg-black pointer-events-auto text-white p-6 border border-zinc-800 shadow-2xl w-80 font-mono relative">
						
						{/* Botón Cerrar */}
						<button 
							onClick={() => setSelectedThought(null)}
							className="absolute -top-3 -right-3 bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800 p-1 rounded-full transition-colors cursor-pointer"
						>
							<X size={14} />
						</button>

						{/* Cabecera: Avatar y Nombre */}
						<div className="flex items-center gap-4 border-b border-zinc-900 pb-4 mb-4">
							<img
								src={selectedThought.photoURL || "/favicon.svg"}
								alt="Avatar"
								className="w-10 h-10 rounded-full border border-zinc-800 grayscale hover:grayscale-0 transition-all object-cover"
							/>
							<div className="flex flex-col">
								<span className="text-sm font-bold tracking-widest uppercase text-white">
									{selectedThought.displayName?.split(" ")[0] || "ANÓNIMO"}
								</span>
								<span className="text-[10px] text-emerald-500 uppercase tracking-[0.2em]">
									{selectedThought.category}
								</span>
							</div>
						</div>

						{/* Mensaje */}
						<p className="text-zinc-300 text-sm leading-relaxed mb-6 font-light italic">
							"{selectedThought.text}"
						</p>

						{/* Pie: Ubicación y Botón */}
						<div className="flex justify-between items-end">
							<div className="flex items-center gap-1 text-[10px] text-zinc-600 uppercase">
								<MapPin size={10} />
								{selectedThought.cityName || selectedThought.countryName || "SISTEMA"}
							</div>
							
							<button
								onClick={() => openProfile(selectedThought)}
								className="text-[10px] bg-white text-black px-3 py-1 uppercase font-bold tracking-wider hover:bg-zinc-200 transition-colors cursor-pointer"
							>
								PERFIL
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};