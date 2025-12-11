import React, { useState, useEffect, useRef, useMemo } from "react";
// NO importamos librerías 3D aquí arriba para evitar errores de servidor
import { MapPin, X } from "lucide-react";

// --- RECURSOS HD ---
const EARTH_BASE_HD = "//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"; 
const EARTH_TOPOLOGY = "//unpkg.com/three-globe/example/img/earth-topology.png";
const CLOUDS_IMG = "//unpkg.com/three-globe/example/img/clouds.png";

// --- COLORES ---
const THEME_COLOR = "#06b6d4"; 
const ATMOSPHERE_COLOR = "#3a9efd";

export const MapComponent = ({ messages, openProfile }) => {
	const globeEl = useRef();
	// Estado para cargar las librerías solo en el cliente
	const [GlobePackage, setGlobePackage] = useState(null);
	const [ThreePackage, setThreePackage] = useState(null);
	
	const [dimensions, setDimensions] = useState({ width: 800, height: 800 });
	const [globeReady, setGlobeReady] = useState(false);

	// 1. CARGA SEGURA DE LIBRERÍAS
	useEffect(() => {
		if (typeof window !== "undefined") {
			Promise.all([
				import("react-globe.gl"),
				import("three")
			]).then(([globeMod, threeMod]) => {
				setGlobePackage(() => globeMod.default);
				setThreePackage(threeMod);
			}).catch(err => console.error("Error cargando 3D:", err));
		}
	}, []);

	// 2. AJUSTE DE PANTALLA
	useEffect(() => {
		if (typeof window === 'undefined') return;
		const handleResize = () => {
			setDimensions({ width: window.innerWidth, height: window.innerHeight });
		};
		window.addEventListener('resize', handleResize);
		handleResize();
		return () => window.removeEventListener('resize', handleResize);
	}, []);

	// 3. CONFIGURACIÓN DEL GLOBO
	useEffect(() => {
		if (GlobePackage && ThreePackage && globeEl.current && !globeReady) {
			setGlobeReady(true);
			const globe = globeEl.current;
			const THREE = ThreePackage;
			
			// Calidad de renderizado
			const renderer = globe.renderer();
			renderer.setPixelRatio(window.devicePixelRatio || 1); 
			renderer.antialias = true;
			renderer.shadowMap.enabled = true;
			renderer.shadowMap.type = THREE.PCFSoftShadowMap;

			// Controles
			const controls = globe.controls();
			controls.autoRotate = false; // Estático para facilitar la interacción
			controls.enableZoom = true;
			controls.zoomSpeed = 1.2;
			controls.dampingFactor = 0.05;
			controls.minDistance = globe.getGlobeRadius() * 1.001; 
			controls.maxDistance = globe.getGlobeRadius() * 10;

			// Iluminación
			globe.scene().children = globe.scene().children.filter(ch => ch.type !== 'DirectionalLight' && ch.type !== 'AmbientLight');
			
			const sunLight = new THREE.DirectionalLight(0xffffff, 2.0);
			sunLight.position.set(-100, 50, 50); 
			globe.scene().add(sunLight);
			
			const ambientLight = new THREE.AmbientLight(0x404060, 1.2); 
			globe.scene().add(ambientLight);
			
			const rimLight = new THREE.DirectionalLight(THEME_COLOR, 2.5);
			rimLight.position.set(50, 0, -80);
			globe.scene().add(rimLight);

			// Nubes
			new THREE.TextureLoader().load(CLOUDS_IMG, (cloudsTexture) => {
				const cloudsMaterial = new THREE.MeshPhongMaterial({
					map: cloudsTexture,
					transparent: true,
					opacity: 0.3,
					blending: THREE.AdditiveBlending,
					side: THREE.DoubleSide,
					depthWrite: false,
				});
				const cloudsMesh = new THREE.Mesh(new THREE.SphereGeometry(globe.getGlobeRadius() * 1.012, 75, 75), cloudsMaterial);
				globe.scene().add(cloudsMesh);
				
				const rotateClouds = () => {
					if (cloudsMesh) cloudsMesh.rotation.y += 0.00005; 
					requestAnimationFrame(rotateClouds);
				};
				rotateClouds();
			});

			globe.pointOfView({ altitude: 2.0, lat: 20, lng: 0 });
		}
	}, [GlobePackage, ThreePackage, globeReady]);

	// 4. DATOS
	const mapData = useMemo(() => {
		// Invertimos el array para que los mensajes nuevos se pinten al final del DOM (encima)
		return messages
			.filter(m => m.location && m.location.lat && m.location.lon)
			.reverse(); 
	}, [messages]);

	// Placeholder mientras carga para evitar errores
	if (!GlobePackage) return <div className="w-full h-full bg-black" />;

	const Globe = GlobePackage;

	return (
		<div className="relative w-full h-full bg-black cursor-move select-none">
			<Globe
				ref={globeEl}
				width={dimensions.width}
				height={dimensions.height}
				rendererConfig={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
				globeImageUrl={EARTH_BASE_HD} 
				bumpImageUrl={EARTH_TOPOLOGY}
				bumpScale={6}
				globeTileEngineUrl={(x, y, l) => l > 19 ? null : `https://mt1.google.com/vt/lyrs=s&x=${x}&y=${y}&z=${l}`}
				backgroundColor="#000000"
				atmosphereColor={ATMOSPHERE_COLOR}
				atmosphereAltitude={0.18}
				
				htmlElementsData={mapData}
				htmlLat={d => d.location.lat}
				htmlLng={d => d.location.lon}
				htmlAltitude={0}
				htmlTransitionDuration={300}
				htmlElement={d => {
					const el = document.createElement('div');
					
					// --- ESTILOS CRÍTICOS PARA INTERACCIÓN ---
					el.style.pointerEvents = "auto"; // Habilita interacción
					el.style.cursor = "help"; 
					el.style.position = "relative";
					el.style.zIndex = "10"; // Nivel base

					// --- MANEJO DE Z-INDEX AL PASAR EL RATÓN ---
					// Esto evita parpadeos al no usar React para el estado visual
					el.onmouseenter = () => { el.style.zIndex = "10000"; };
					el.onmouseleave = () => { el.style.zIndex = "10"; };

					// --- BLOQUEO DE ARRASTRE DEL MAPA ---
					// Si tocas el marcador, el mapa NO se debe mover.
					const stopPropagation = (e) => { e.stopPropagation(); };
					el.addEventListener('pointerdown', stopPropagation);
					el.addEventListener('mousedown', stopPropagation);
					el.addEventListener('touchstart', stopPropagation, { passive: true });

					// --- ESTRUCTURA HTML (CSS PURO PARA HOVER) ---
					// Usamos 'group' y 'group-hover' de Tailwind.
					// El popup está oculto (opacity-0) y aparece al hacer hover sobre el padre (opacity-100).
					el.innerHTML = `
						<div class="flex flex-col items-center transform -translate-x-1/2 -translate-y-full group w-max">
							
							<div class="absolute bottom-[120%] mb-2 w-80 bg-zinc-950/95 border border-cyan-500 rounded-xl overflow-hidden shadow-[0_0_60px_rgba(6,182,212,0.6)] backdrop-blur-xl origin-bottom transition-all duration-300 opacity-0 translate-y-4 scale-95 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-100 group-hover:pointer-events-auto ring-1 ring-white/20 z-50">
								<div class="h-1 w-full bg-gradient-to-r from-cyan-500 via-white to-cyan-500 opacity-80"></div>
								<div class="p-5 flex flex-col gap-4">
									<div class="flex items-center gap-4 border-b border-white/10 pb-3">
										<img src="${d.photoURL || '/favicon.svg'}" class="w-12 h-12 rounded-full border-2 border-cyan-400 object-cover bg-black" />
										<div class="flex flex-col min-w-0">
											<span class="text-sm font-bold uppercase tracking-widest text-white truncate">
												${d.displayName ? d.displayName.split(' ')[0] : 'ANÓNIMO'}
											</span>
											<span class="text-[10px] text-cyan-400 font-mono flex items-center gap-1.5 mt-0.5 uppercase truncate">
												<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
												${d.cityName || d.countryName || 'SISTEMA'}
											</span>
										</div>
									</div>
									<div class="relative">
										<div class="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-cyan-500 to-transparent"></div>
										<p class="text-sm font-light text-zinc-200 italic leading-relaxed pl-3 text-wrap break-words">
											"${d.text}"
										</p>
									</div>
									<button class="js-profile-btn mt-1 w-full py-2.5 bg-white text-black hover:bg-cyan-400 text-[10px] uppercase font-bold tracking-[0.2em] rounded transition-all shadow-lg active:scale-95 cursor-pointer">
										Ver Perfil
									</button>
								</div>
							</div>

							<div class="w-9 h-9 rounded-full border bg-black/60 text-cyan-400 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.3)] backdrop-blur-md flex items-center justify-center transition-all duration-300 transform group-hover:scale-125 group-hover:bg-black/90 group-hover:text-white group-hover:border-cyan-400 group-hover:shadow-[0_0_30px_rgba(255,255,255,0.5)]">
								<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
									<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
									<path d="M8 10h8"/>
									<path d="M8 14h4"/>
								</svg>
							</div>
						</div>
					`;

					// --- LOGICA DE CLIC (MANUAL PARA EL BOTÓN DE PERFIL) ---
					el.addEventListener('click', (e) => {
						// Solo si el usuario hace clic en el botón de perfil
						if (e.target.closest('.js-profile-btn')) {
							e.stopPropagation(); // Evitar propagación extra
							openProfile(d); // Ejecutar función de React
						}
					});

					return el;
				}}
			/>
		</div>
	);
};