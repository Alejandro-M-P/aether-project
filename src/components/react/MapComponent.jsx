import React, { useState, useEffect, useRef, useMemo } from "react";
import Globe from "react-globe.gl";
import { MapPin, X } from "lucide-react";
import * as THREE from "three";

// --- RECURSOS ---
const CLOUDS_IMG = "//unpkg.com/three-globe/example/img/clouds.png";
const EARTH_TOPOLOGY = "//unpkg.com/three-globe/example/img/earth-topology.png";
const EARTH_BASE = "//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"; 

// --- CONFIGURACIÓN DE COLOR ---
const THEME_COLOR = "#06b6d4"; 
const ATMOSPHERE_COLOR = "#3a9efd";

export const MapComponent = ({ messages, openProfile }) => {
	const globeEl = useRef();
	const [selectedThought, setSelectedThought] = useState(null);
	const [dimensions, setDimensions] = useState({ width: 800, height: 800 });
	const [globeReady, setGlobeReady] = useState(false);

	// 1. AJUSTE DE PANTALLA
	useEffect(() => {
		const handleResize = () => {
			if (typeof window !== 'undefined') {
				setDimensions({
					width: window.innerWidth,
					height: window.innerHeight
				});
			}
		};
		if (typeof window !== 'undefined') {
			window.addEventListener('resize', handleResize);
			handleResize();
		}
		return () => {
			if (typeof window !== 'undefined') window.removeEventListener('resize', handleResize);
		};
	}, []);

	// 2. CONFIGURACIÓN VISUAL
	useEffect(() => {
		if (globeEl.current && !globeReady) {
			setGlobeReady(true);
			const globe = globeEl.current;
			const controls = globe.controls();
			
			// --- CONTROLES DE ALTA PRECISIÓN ---
			controls.autoRotate = false;
			controls.enableZoom = true;
			controls.zoomSpeed = 1.0;
			controls.dampingFactor = 0.1;
			
			// AJUSTE CRÍTICO: Permitimos acercarnos muchísimo (casi a nivel de calle)
			controls.minDistance = globe.getGlobeRadius() * 1.001; 
			controls.maxDistance = globe.getGlobeRadius() * 10;

			// --- ILUMINACIÓN ---
			const sunLight = new THREE.DirectionalLight(0xffffff, 2.0);
			sunLight.position.set(-10, 10, 5);
			globe.scene().add(sunLight);
			
			const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); 
			globe.scene().add(ambientLight);

			// --- NUBES ---
			new THREE.TextureLoader().load(CLOUDS_IMG, (cloudsTexture) => {
				const cloudsMaterial = new THREE.MeshPhongMaterial({
					map: cloudsTexture,
					transparent: true,
					opacity: 0.4,
					blending: THREE.AdditiveBlending,
					side: THREE.DoubleSide,
					depthWrite: false,
				});
				
				const cloudsRadius = globe.getGlobeRadius() * 1.015;
				
				const cloudsMesh = new THREE.Mesh(
					new THREE.SphereGeometry(cloudsRadius, 75, 75),
					cloudsMaterial
				);
				
				globe.scene().add(cloudsMesh);
				
				const rotateClouds = () => {
					if (cloudsMesh) cloudsMesh.rotation.y += 0.0001; 
					requestAnimationFrame(rotateClouds);
				};
				rotateClouds();
			});

			globe.pointOfView({ altitude: 2.0, lat: 20, lng: 0 });
		}
	}, [globeReady]);

	const validMessages = useMemo(() => {
		return messages.filter(m => m.location && m.location.lat && m.location.lon);
	}, [messages]);

	return (
		<div className="relative w-full h-full bg-black cursor-move select-none">
			<Globe
				ref={globeEl}
				width={dimensions.width}
				height={dimensions.height}
				
				// --- MOTOR DE MAPA GOOGLE HD ---
				globeImageUrl={EARTH_BASE} 
				globeTileEngineUrl={(x, y, l) => {
					// [CORRECCIÓN CLAVE]: Aumentamos el límite de zoom de 12 a 19.
					// Esto permite cargar las texturas de máxima resolución al acercarse.
					if (l > 19) return null; 
					return `https://mt1.google.com/vt/lyrs=s&x=${x}&y=${y}&z=${l}`;
				}}
				
				// Ajustamos el relieve para que no se vea exagerado al hacer mucho zoom
				bumpImageUrl={EARTH_TOPOLOGY}
				bumpScale={5} 
				
				// --- AMBIENTE ---
				backgroundColor="#000000"
				atmosphereColor={ATMOSPHERE_COLOR}
				atmosphereAltitude={0.15}
				
				// --- MARCADORES ---
				htmlElementsData={validMessages}
				htmlLat={d => d.location.lat}
				htmlLng={d => d.location.lon}
				htmlAltitude={0} 
				htmlElement={d => {
					const el = document.createElement('div');
					el.style.cursor = "pointer";
					el.style.pointerEvents = "auto"; 

					el.innerHTML = `
						<div style="transform: translate(-50%, -100%);" class="relative group flex flex-col items-center justify-center transition-transform duration-300 hover:scale-110">
							<div class="absolute inset-0 bg-cyan-500/40 rounded-xl blur-md animate-pulse z-0"></div>
							<div class="relative bg-black/70 backdrop-blur-md p-2 rounded-xl border border-cyan-400/80 shadow-[0_0_15px_#06b6d4] z-10 flex items-center justify-center">
								<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${THEME_COLOR}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
									<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
								</svg>
							</div>
							<div class="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-cyan-400/80 relative -mt-1 z-10 filter drop-shadow-[0_2px_3px_#06b6d4]"></div>
						</div>
					`;
					
					el.onclick = (e) => {
						e.stopPropagation(); 
						setSelectedThought(d);
						
						// Zoom muy cercano al hacer clic para aprovechar la nueva calidad
						globeEl.current.pointOfView({
							lat: d.location.lat,
							lng: d.location.lon,
							altitude: 0.1 // Muy cerca
						}, 2000);
					};
					return el;
				}}
			/>

			{/* --- MODAL MENSAJE --- */}
			{selectedThought && (
				<div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 animate-in zoom-in duration-300 w-full max-w-sm px-4 pointer-events-none">
					<div className="bg-black/95 pointer-events-auto text-white p-6 border border-zinc-800 shadow-[0_0_100px_rgba(6,182,212,0.25)] relative backdrop-blur-xl ring-1 ring-cyan-500/30 rounded-sm">
						
						<button 
							onClick={() => setSelectedThought(null)}
							className="absolute -top-3 -right-3 bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-700 hover:border-cyan-500 p-1.5 rounded-full transition-all cursor-pointer z-20 shadow-lg"
						>
							<X size={16} />
						</button>

						<div className="flex items-center gap-4 border-b border-zinc-900 pb-4 mb-5">
							<div className="relative">
								<img
									src={selectedThought.photoURL || "/favicon.svg"}
									alt="User"
									className="w-12 h-12 rounded-full border border-zinc-800 object-cover grayscale opacity-90"
								/>
								<div className="absolute -bottom-1 -right-1 w-3 h-3 bg-cyan-500 border-2 border-black rounded-full shadow-[0_0_10px_#06b6d4]"></div>
							</div>
							<div>
								<h3 className="text-sm font-bold tracking-[0.2em] text-white uppercase">
									{selectedThought.displayName?.split(" ")[0] || "ANÓNIMO"}
								</h3>
								<div className="mt-1">
									<span className="text-[10px] bg-zinc-900 text-cyan-400 border border-zinc-800 px-2 py-0.5 rounded uppercase tracking-wider shadow-inner">
										{selectedThought.category}
									</span>
								</div>
							</div>
						</div>

						<div className="mb-6 relative">
							<p className="text-zinc-200 text-base font-light leading-relaxed italic pl-3 border-l-2 border-cyan-500">
								"{selectedThought.text}"
							</p>
						</div>

						<div className="flex justify-between items-center pt-3 border-t border-zinc-900">
							<div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono uppercase">
								<MapPin size={12} className="text-cyan-500" />
								{selectedThought.cityName || selectedThought.countryName || "SISTEMA"}
							</div>
							
							<button
								onClick={() => openProfile(selectedThought)}
								className="text-[10px] bg-white text-black hover:bg-cyan-400 px-5 py-2 uppercase font-bold tracking-widest transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-[0_0_15px_rgba(6,182,212,0.3)]"
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