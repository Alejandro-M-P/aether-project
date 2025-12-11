import React, { useState, useEffect, useRef, useMemo } from "react";
import { User, MapPin, MessageCircle } from "lucide-react"; 

// --- GOOGLE MAPS TILES (Modo Satélite Puro) ---
const GOOGLE_TILES_URL = (x, y, z) => 
    `https://mt1.google.com/vt/lyrs=s&x=${x}&y=${y}&z=${z}`;

// Mapa de colores por categoría
const CATEGORY_COLORS = {
    'IDEAS': 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
    'NOTICIAS': 'text-purple-400 bg-purple-400/10 border-purple-400/20',
    'GENERAL': 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',
};

export const MapComponent = ({ messages = [], openProfile }) => {
    const globeEl = useRef();
    const [GlobePackage, setGlobePackage] = useState(null);
    const [ThreePackage, setThreePackage] = useState(null);
    
    const [selectedThoughtId, setSelectedThoughtId] = useState(null);
    const [dimensions, setDimensions] = useState({ width: 800, height: 800 });
    const [globeReady, setGlobeReady] = useState(false);
    const markersRef = useRef({});

    // 1. CARGA
    useEffect(() => {
        if (typeof window !== "undefined") {
            Promise.all([import("react-globe.gl"), import("three")])
                .then(([globeMod, threeMod]) => {
                    setGlobePackage(() => globeMod.default);
                    setThreePackage(threeMod);
                });
        }
    }, []);

    // 2. RESIZE
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const handleResize = () => setDimensions({ width: window.innerWidth, height: window.innerHeight });
        window.addEventListener('resize', handleResize);
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // 3. CONFIGURACIÓN TÉCNICA
    useEffect(() => {
        if (GlobePackage && ThreePackage && globeEl.current && !globeReady) {
            setGlobeReady(true);
            const globe = globeEl.current;
            const THREE = ThreePackage;
            
            const renderer = globe.renderer();
            renderer.setPixelRatio(window.devicePixelRatio || 1); 
            renderer.antialias = true;
            renderer.shadowMap.enabled = false;

            const controls = globe.controls();
            controls.autoRotate = false; // ESTÁTICO
            controls.enableZoom = true;
            controls.dampingFactor = 0.1;
            controls.minDistance = globe.getGlobeRadius() * 1.001; 
            controls.maxDistance = globe.getGlobeRadius() * 10;

            // Iluminación Plana
            globe.scene().children = globe.scene().children.filter(ch => ch.type !== 'DirectionalLight' && ch.type !== 'AmbientLight');
            const ambientLight = new THREE.AmbientLight(0xffffff, 2.0); 
            globe.scene().add(ambientLight);

            globe.pointOfView({ altitude: 1.5, lat: 20, lng: 0 });
        }
    }, [GlobePackage, ThreePackage, globeReady]);

    const mapData = useMemo(() => {
        return messages
            .filter(m => m.location?.lat && m.location?.lon)
            .map(m => ({ ...m, isSelected: m.id === selectedThoughtId }))
            .reverse(); 
    }, [messages, selectedThoughtId]);

    if (!GlobePackage) return <div className="w-full h-full bg-[#0a0a0a]" />;
    const Globe = GlobePackage;

    return (
        <div className="relative w-full h-full bg-[#0a0a0a] cursor-move select-none">
            <Globe
                ref={globeEl}
                width={dimensions.width}
                height={dimensions.height}
                globeTileEngineUrl={GOOGLE_TILES_URL}
                globeImageUrl={null} 
                backgroundColor="#0a0a0a"
                atmosphereColor="#3a9efd"
                atmosphereAltitude={0.05} 
                htmlTransitionDuration={0}
                animateIn={false}
                pointsData={mapData}
                pointLat={d => d.location.lat}
                pointLng={d => d.location.lon}
                pointAltitude={0.001}
                pointRadius={1}
                pointColor={() => 'transparent'}
                onPointClick={(d) => {
                    setSelectedThoughtId(d.id);
                    globeEl.current.pointOfView({ lat: d.location.lat, lng: d.location.lon, altitude: 0.2 }, 800);
                }}
                onGlobeClick={() => setSelectedThoughtId(null)}

                // --- MARCADORES HTML ---
                htmlElementsData={mapData}
                htmlLat={d => d.location.lat}
                htmlLng={d => d.location.lon}
                htmlAltitude={0}
                htmlElement={d => {
                    if (!markersRef.current[d.id]) {
                        const wrapper = document.createElement('div');
                        wrapper.className = "flex flex-col items-center justify-end transform -translate-x-1/2 -translate-y-[100%]";
                        wrapper.style.pointerEvents = "none"; 

                        const category = d.category ? String(d.category).toUpperCase() : 'GENERAL';
                        const categoryClass = CATEGORY_COLORS[category] || CATEGORY_COLORS['GENERAL'];
                        const photo = d.photoURL || 'https://abs.twimg.com/sticky/default_profile_images/default_profile_400x400.png'; // Avatar de reserva

                        // Contenido HTML del marcador y popup
                        wrapper.innerHTML = `
                            <div class="js-popup absolute bottom-[115%] mb-4 w-72 bg-black/90 border border-zinc-700 rounded-lg shadow-xl origin-bottom transition-all duration-200 z-50 overflow-hidden" style="pointer-events: auto; display: none;">
                                
                                <div class="px-4 py-3 flex items-start gap-4 border-b border-zinc-800">
                                    <img src="${photo}" class="w-8 h-8 rounded-full border border-cyan-500/50 object-cover bg-zinc-900" />
                                    <div class="flex-1 min-w-0">
                                        <div class="flex items-center justify-between">
                                            <span class="text-xs font-mono uppercase tracking-widest text-cyan-400 truncate max-w-[120px]">
                                                ${d.displayName ? d.displayName.split(' ')[0] : 'ANÓNIMO'}
                                            </span>
                                            <span class="px-2 py-0.5 rounded-full text-[9px] uppercase font-bold tracking-wider ${categoryClass}">
                                                ${category}
                                            </span>
                                        </div>
                                        <span class="text-[10px] text-zinc-600 font-mono flex items-center gap-1 mt-1">
                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                                            ${d.cityName || d.countryName || 'Localizado'}
                                        </span>
                                    </div>
                                </div>
                                
                                <div class="p-4">
                                    <p class="text-sm text-white font-light leading-relaxed italic">"${d.text}"</p>
                                </div>
                                
                                <button class="js-profile-btn w-full py-2 bg-zinc-900/50 hover:bg-zinc-800/80 border-t border-zinc-800 text-[10px] font-bold text-cyan-400 uppercase tracking-widest transition-colors cursor-pointer flex items-center justify-center gap-2 group">
                                    <svg class="w-3 h-3" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> Ver Perfil
                                </button>
                                
                                <div class="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-black/90 border-r border-b border-zinc-700 rotate-45"></div>
                            </div>

                            <div class="js-icon-container cursor-pointer group relative hover:z-50" style="pointer-events: auto;">
                                
                                <div class="js-glow absolute inset-0 bg-cyan-500 rounded-full blur-md opacity-0 group-hover:opacity-50 transition-opacity duration-300 scale-150"></div>
                                
                                <img 
                                    src="${photo}" 
                                    class="js-marker-photo relative w-8 h-8 rounded-full object-cover border-2 border-cyan-400 transition-all duration-300 group-hover:scale-110 group-hover:border-white" 
                                />
                                
                                <div class="js-pulse absolute inset-0 rounded-full border-4 border-cyan-400 opacity-0 animate-pulse" style="animation-duration: 1.5s;"></div>
                            </div>
                        `;

                        // --- EVENT LISTENERS ---
                        const stopProp = (e) => e.stopPropagation();
                        const iconContainer = wrapper.querySelector('.js-icon-container');
                        const popup = wrapper.querySelector('.js-popup');
                        const btn = wrapper.querySelector('.js-profile-btn');

                        iconContainer.addEventListener('mousedown', stopProp);
                        if (popup) popup.addEventListener('mousedown', stopProp);

                        iconContainer.addEventListener('click', (e) => {
                            e.stopPropagation();
                            const data = wrapper.__data;
                            if (data) {
                                setSelectedThoughtId(data.id);
                                globeEl.current.pointOfView({ lat: data.location.lat, lng: data.location.lon, altitude: 0.25 }, 1000);
                            }
                        });

                        if(btn) {
                            btn.addEventListener('click', (e) => {
                                e.stopPropagation();
                                if (wrapper.__data && openProfile) openProfile(wrapper.__data);
                            });
                        }

                        markersRef.current[d.id] = wrapper;
                    }

                    const el = markersRef.current[d.id];
                    el.__data = d; 
                    const popupEl = el.querySelector('.js-popup');
                    const photoEl = el.querySelector('.js-marker-photo');
                    const pulseEl = el.querySelector('.js-pulse');
                    const glowEl = el.querySelector('.js-glow');
                    
                    const isSelected = d.id === selectedThoughtId;
                    
                    // Actualizar estilos basados en la selección
                    if (isSelected) {
                        el.style.zIndex = "1000";
                        if (popupEl) popupEl.style.display = "block";
                        if (photoEl) {
                            photoEl.classList.add('scale-125', 'border-white', 'shadow-xl');
                            photoEl.classList.remove('border-cyan-400');
                        }
                        if (pulseEl) pulseEl.style.opacity = "0.4";
                        if (glowEl) glowEl.style.opacity = "0"; 
                    } else {
                        el.style.zIndex = "10";
                        if (popupEl) popupEl.style.display = "none";
                        if (photoEl) {
                            photoEl.classList.remove('scale-125', 'border-white', 'shadow-xl');
                            photoEl.classList.add('border-cyan-400');
                        }
                        if (pulseEl) pulseEl.style.opacity = "0";
                    }


                    return el;
                }}
            />
        </div>
    );
};