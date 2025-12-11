import React, { useState, useEffect, useRef, useMemo } from "react";
import * as THREE from "three";

// --- TILES DE GOOGLE (SATÉLITE) ---
const GOOGLE_TILES_URL = (x, y, z) => 
    `https://mt1.google.com/vt/lyrs=s&x=${x}&y=${y}&z=${z}`;

// Mapa de colores por categoría
const CATEGORY_COLORS = {
    'Ideas': 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
    'Noticias': 'text-purple-400 bg-purple-400/10 border-purple-400/20',
    'General': 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',
};

// Renombrado a UniverseCanvas para coincidir con la importación en Astro
export const UniverseCanvas = ({ messages = [], openProfile }) => {
    const globeEl = useRef();
    const [GlobePackage, setGlobePackage] = useState(null);
    const [selectedThoughtId, setSelectedThoughtId] = useState(null);
    
    // Ajuste Final para Dimensiones
    const getInitialDimensions = () => {
        if (typeof window !== "undefined") {
            return { width: window.innerWidth, height: window.innerHeight };
        }
        return { width: 1000, height: 1000 };
    };
    const [dimensions, setDimensions] = useState(getInitialDimensions);
    const markersRef = useRef({});

    // 1. CARGA SEGURA Y RESIZE
    useEffect(() => {
        if (typeof window !== "undefined") {
            // Importación dinámica de la librería 3D
            import('react-globe.gl').then(mod => {
                setGlobePackage(() => mod.default);
            }).catch(err => console.error("Error cargando librería react-globe.gl:", err));
            
            // Seteamos dimensiones iniciales y añadimos listener
            const handleResize = () => {
                setDimensions({ width: window.innerWidth, height: window.innerHeight });
            };
            window.addEventListener('resize', handleResize);
            return () => window.removeEventListener('resize', handleResize);
        }
    }, []);

    // 2. CONFIGURACIÓN VISUAL (Luces, Controles, etc.)
    const handleGlobeReady = () => {
        if (globeEl.current) {
            const globe = globeEl.current;
            
            // Configurar Renderer y Controles
            const renderer = globe.renderer();
            renderer.setPixelRatio(window.devicePixelRatio || 1); 
            
            const controls = globe.controls();
            controls.autoRotate = true;
            controls.autoRotateSpeed = 0.5;
            controls.enableZoom = true;
            controls.dampingFactor = 0.1;
            controls.minDistance = globe.getGlobeRadius() * 1.01; 

            // Iluminación
            const scene = globe.scene();
            scene.children = scene.children.filter(ch => ch.type !== 'DirectionalLight' && ch.type !== 'AmbientLight');
            const ambient = new THREE.AmbientLight(0xffffff, 1.5);
            const directional = new THREE.DirectionalLight(0xffffff, 1);
            directional.position.set(10, 10, 10);
            scene.add(ambient, directional);
            
            // Vista inicial
            globe.pointOfView({ altitude: 1.8, lat: 20, lng: 0 });
        }
    };

    // 3. DATOS A RENDERIZAR
    const mapData = useMemo(() => {
        if (!messages) return [];
        return messages
            .filter(m => m.location?.lat && m.location?.lon)
            .map(m => ({ ...m, isSelected: m.id === selectedThoughtId }))
            .reverse(); 
    }, [messages, selectedThoughtId]);

    // Si la librería no cargó, muestra un placeholder de carga.
    if (!GlobePackage) {
        return <div className="fixed inset-0 flex items-center justify-center text-cyan-500 font-mono text-xs bg-[#0a0a0a]">INICIALIZANDO SATÉLITE...</div>;
    }

    const Globe = GlobePackage;

    return (
        // Contenedor
        <div className="fixed inset-0 bg-[#0a0a0a] cursor-move select-none overflow-hidden -z-10">
            <Globe
                ref={globeEl}
                width={dimensions.width}
                height={dimensions.height}
                globeTileEngineUrl={null} 
                globeImageUrl="/earth-blue-marble.jpg" 
                cloudsImageUrl="/clouds.jpg" 
                globeInertia={0} 
                backgroundColor="#0a0a0a" 
                atmosphereColor="#3a9efd"
                atmosphereAltitude={0.15} 
                onGlobeReady={handleGlobeReady}
                
                // Propiedad para forzar el dibujo de la geometría base
                hexPolygonsData={[]} 
                // Forzar posición inicial en el render 
                pointOfView={{ altitude: 1.8, lat: 20, lng: 0 }} 

                // Puntos (Invisibles para interacción)
                pointsData={mapData}
                pointLat={d => d.location.lat}
                pointLng={d => d.location.lon}
                pointAltitude={0.001}
                pointRadius={2.5} 
                pointColor={() => 'transparent'}
                onPointClick={(d) => {
                    setSelectedThoughtId(d.id);
                    if(globeEl.current) {
                        globeEl.current.controls().autoRotate = false; // Detener rotación al seleccionar
                        globeEl.current.pointOfView({ lat: d.location.lat, lng: d.location.lon, altitude: 0.3 }, 1000);
                    }
                }}
                onGlobeClick={() => {
                    setSelectedThoughtId(null);
                    if(globeEl.current) globeEl.current.controls().autoRotate = true; // Reanudar rotación
                }}

                // Marcadores HTML (Popups)
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

                        // Sintaxis de string HTML corregida
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

                    // Event Listeners (para clicks)
                    const stopProp = (e) => e.stopPropagation();
                    const iconContainer = wrapper.querySelector('.js-icon-container');
                    const popup = wrapper.querySelector('.js-popup');
                    const btn = wrapper.querySelector('.js-profile-btn');

                    iconContainer.addEventListener('mousedown', stopProp);
                    popup.addEventListener('mousedown', stopProp);

                    iconContainer.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (wrapper.__data) {
                            setSelectedThoughtId(wrapper.__data.id);
                            if(globeEl.current) {
                                globeEl.current.controls().autoRotate = false; // Detener rotación al seleccionar
                                globeEl.current.pointOfView({ lat: wrapper.__data.location.lat, lng: wrapper.__data.location.lon, altitude: 0.3 }, 1000);
                            }
                        }
                    });

                    if(btn && openProfile) {
                        btn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            if (wrapper.__data) openProfile(wrapper.__data);
                        });
                    }

                    markersRef.current[d.id] = wrapper;
                }

                // Lógica de Activo/Inactivo (Necesaria en cada render)
                const el = markersRef.current[d.id];
                el.__data = d; 
                const popupEl = el.querySelector('.js-popup');
                const iconPath = el.querySelector('svg path');
                const iconCircle = el.querySelector('svg circle');

                if (d.isSelected) {
                    el.style.zIndex = "1000";
                    popupEl.style.display = "block";
                    iconPath.setAttribute('stroke', '#ffffff');
                    iconPath.setAttribute('stroke-width', '3');
                    iconCircle.setAttribute('fill', '#ffffff');
                } else {
                    el.style.zIndex = "10";
                    popupEl.style.display = "none";
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

// Alias para compatibilidad
export const MapComponent = UniverseCanvas;
export default UniverseCanvas;