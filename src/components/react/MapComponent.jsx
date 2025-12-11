import React, { useState, useEffect, useRef, useMemo } from "react";
// Asegúrate de instalar: npm install three react-globe.gl

// --- GOOGLE MAPS TILES (Modo Satélite Puro) ---
const GOOGLE_TILES_URL = (x, y, z) => 
    `https://mt1.google.com/vt/lyrs=s&x=${x}&y=${y}&z=${z}`;

// Mapa de colores por categoría
const CATEGORY_COLORS = {
    'Ideas': 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
    'Noticias': 'text-purple-400 bg-purple-400/10 border-purple-400/20',
    'General': 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',
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

                        const category = d.category || 'General';
                        const categoryClass = CATEGORY_COLORS[category] || CATEGORY_COLORS['General'];
                        const photo = d.photoURL || 'https://abs.twimg.com/sticky/default_profile_images/default_profile_400x400.png';

                        wrapper.innerHTML = `
                            <div class="js-popup absolute bottom-[115%] mb-2 w-72 bg-zinc-950 border border-zinc-800 rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.8)] origin-bottom transition-all duration-200 z-50 overflow-hidden" style="pointer-events: auto; display: none;">
                                <div class="px-4 pt-4 flex justify-between items-start">
                                    <div class="flex items-center gap-3">
                                        <img src="${photo}" class="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 object-cover" />
                                        <div class="flex flex-col">
                                            <span class="text-white font-bold text-sm truncate max-w-[120px]">${d.displayName || 'Anónimo'}</span>
                                            <span class="text-[10px] text-zinc-500 font-mono uppercase">${d.cityName || 'Ubicación'}</span>
                                        </div>
                                    </div>
                                    <span class="px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider border ${categoryClass}">
                                        ${category}
                                    </span>
                                </div>
                                <div class="px-4 py-3">
                                    <p class="text-sm text-zinc-300 font-light leading-relaxed">"${d.text}"</p>
                                </div>
                                <button class="js-profile-btn w-full py-3 bg-zinc-900 hover:bg-zinc-800 border-t border-zinc-800 text-[10px] font-bold text-white uppercase tracking-widest transition-colors cursor-pointer flex items-center justify-center gap-2 group">
                                    Ver Perfil 
                                    <svg class="w-3 h-3 text-zinc-500 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                                </button>
                                <div class="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-zinc-950 border-r border-b border-zinc-800 rotate-45"></div>
                            </div>

                            <div class="js-icon-container cursor-pointer group relative hover:z-50" style="pointer-events: auto;">
                                <div class="absolute inset-0 bg-cyan-500 rounded-full blur-md opacity-0 group-hover:opacity-50 transition-opacity duration-300 scale-150"></div>
                                
                                <div class="js-icon relative transition-transform duration-200 group-hover:-translate-y-1">
                                    <svg width="40" height="48" viewBox="0 0 40 48" fill="none" xmlns="http://www.w3.org/2000/svg" class="drop-shadow-lg">
                                        <path d="M20 48C20 48 40 30.6 40 20C40 8.95431 31.0457 0 20 0C8.9543 0 0 8.95431 0 20C0 30.6 20 48 20 48Z" fill="#09090b" stroke="#06b6d4" stroke-width="2"/>
                                        <circle cx="20" cy="20" r="6" fill="#06b6d4"/>
                                    </svg>
                                </div>
                            </div>
                        `;

                        // --- EVENT LISTENERS ---
                        const stopProp = (e) => e.stopPropagation();
                        const iconContainer = wrapper.querySelector('.js-icon-container');
                        const popup = wrapper.querySelector('.js-popup');
                        const btn = wrapper.querySelector('.js-profile-btn');

                        iconContainer.addEventListener('mousedown', stopProp);
                        popup.addEventListener('mousedown', stopProp);

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
                    const iconPath = el.querySelector('svg path');
                    const iconCircle = el.querySelector('svg circle');

                    if (d.isSelected) {
                        el.style.zIndex = "1000";
                        popupEl.style.display = "block";
                        // Pin activo: Borde blanco
                        iconPath.setAttribute('stroke', '#ffffff');
                        iconPath.setAttribute('stroke-width', '3');
                        iconCircle.setAttribute('fill', '#ffffff');
                    } else {
                        el.style.zIndex = "10";
                        popupEl.style.display = "none";
                        // Pin normal: Borde cyan
                        iconPath.setAttribute('stroke', '#06b6d4');
                        iconPath.setAttribute('stroke-width', '2');
                        iconCircle.setAttribute('fill', '#06b6d4');
                    }

                    return el;
                }}
            />
        </div>
    );
};