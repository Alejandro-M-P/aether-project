import React, { useState, useEffect, useRef, useMemo } from "react";
import { User, MapPin, MessageCircle, X } from "lucide-react";

const GOOGLE_TILES_URL = (x, y, z) =>
	`https://mt1.google.com/vt/lyrs=s&x=${x}&y=${y}&z=${z}`;

const DEFAULT_AVATAR =
	"https://cdn-icons-png.flaticon.com/512/3214/3214823.png";

const CATEGORY_COLORS = {
	IDEAS: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
	NOTICIAS: "text-purple-400 bg-purple-400/10 border-purple-400/20",
	GENERAL: "text-cyan-400 bg-cyan-400/10 border-cyan-400/20",
};

export const MapComponent = ({ messages = [], openProfile }) => {
	const globeEl = useRef();
	const [GlobePackage, setGlobePackage] = useState(null);
	const [ThreePackage, setThreePackage] = useState(null);

	const [selectedThoughtId, setSelectedThoughtId] = useState(null);
	const [dimensions, setDimensions] = useState({ width: 800, height: 800 });
	const [globeReady, setGlobeReady] = useState(false);
	const markersRef = useRef({});

	useEffect(() => {
		if (typeof window !== "undefined") {
			Promise.all([import("react-globe.gl"), import("three")]).then(
				([globeMod, threeMod]) => {
					const GlobeComponent = globeMod.default?.default || globeMod.default;
					setGlobePackage(() => GlobeComponent);
					setThreePackage(threeMod);
				}
			);
		}
	}, []);

	useEffect(() => {
		if (typeof window === "undefined") return;
		const handleResize = () =>
			setDimensions({ width: window.innerWidth, height: window.innerHeight });
		window.addEventListener("resize", handleResize);
		handleResize();
		return () => window.removeEventListener("resize", handleResize);
	}, []);

	useEffect(() => {
		if (GlobePackage && ThreePackage && globeEl.current && !globeReady) {
			setGlobeReady(true);
			const globe = globeEl.current;
			const THREE = ThreePackage;

			const renderer = globe.renderer();
			renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
			renderer.antialias = true;

			const controls = globe.controls();
			controls.autoRotate = false;
			controls.enableZoom = true;
			controls.dampingFactor = 0.1;
			controls.enableDamping = true;

			// Distancias de zoom
			controls.minDistance = globe.getGlobeRadius() * 1.008;
			controls.maxDistance = globe.getGlobeRadius() * 9;
			controls.zoomSpeed = 0.8;

			globe.scene().children = globe
				.scene()
				.children.filter(
					(ch) => ch.type !== "DirectionalLight" && ch.type !== "AmbientLight"
				);
			const ambientLight = new THREE.AmbientLight(0xffffff, 1.8);
			globe.scene().add(ambientLight);

			globe.pointOfView({ altitude: 1.8, lat: 20, lng: 0 });
		}
	}, [GlobePackage, ThreePackage, globeReady]);

	// ZOOM LÓGICA: Solo si estás lejos (> 0.25). Si estás cerca, NO se mueve.
	const handleSmartZoom = (lat, lng) => {
		if (!globeEl.current) return;
		const currentPov = globeEl.current.pointOfView();

		// Si la altura es mayor a 0.25, bajamos a 0.12.
		// Si ya estás más bajo de 0.25, nos quedamos quietos (target = current).
		if (currentPov.altitude > 0.25) {
			globeEl.current.pointOfView({ lat: lat, lng: lng, altitude: 0.12 }, 1000);
		}
	};

	const mapData = useMemo(() => {
		return messages
			.filter((m) => m.location?.lat && m.location?.lon)
			.map((m) => ({ ...m, isSelected: m.id === selectedThoughtId }))
			.reverse();
	}, [messages, selectedThoughtId]);

	const getLocationText = (d) => {
		const city = d.cityName;
		const country = d.countryName;
		if (city && city !== "undefined" && city !== "null" && city.trim() !== "")
			return city;
		if (
			country &&
			country !== "undefined" &&
			country !== "null" &&
			country.trim() !== ""
		)
			return country;
		return "Localizado";
	};

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
				atmosphereAltitude={0.1}
				htmlTransitionDuration={0}
				animateIn={false}
				pointsData={mapData}
				pointLat={(d) => d.location.lat}
				pointLng={(d) => d.location.lon}
				pointAltitude={0.001}
				// RADIO REDUCIDO: De 1.5 a 0.25 para que no detecte clics en el mar
				pointRadius={0.25}
				pointColor={() => "rgba(0,0,0,0)"}
				onPointClick={(d) => {
					setSelectedThoughtId(d.id);
					handleSmartZoom(d.location.lat, d.location.lon);
				}}
				onGlobeClick={() => setSelectedThoughtId(null)}
				htmlElementsData={mapData}
				htmlLat={(d) => d.location.lat}
				htmlLng={(d) => d.location.lon}
				htmlAltitude={0}
				htmlElement={(d) => {
					if (!markersRef.current[d.id]) {
						const wrapper = document.createElement("div");
						// El wrapper ahora tiene tamaño 0 para no afectar al layout
						wrapper.className = "absolute flex items-center justify-center";
						// translate-y-[-50%] centra verticalmente el punto de anclaje
						wrapper.style.transform = "translate(-50%, -50%)";
						wrapper.style.pointerEvents = "none";

						const category = d.category
							? String(d.category).toUpperCase()
							: "GENERAL";
						const categoryClass =
							CATEGORY_COLORS[category] || CATEGORY_COLORS["GENERAL"];
						const photo =
							d.photoURL && d.photoURL.length > 5 ? d.photoURL : DEFAULT_AVATAR;

						const locationText = getLocationText(d);
						const finalMessage = d.text || d.message || "";

						wrapper.innerHTML = `
                            <div class="relative flex flex-col items-center">

                                <div class="js-popup absolute bottom-[100%] mb-4 w-72 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl transition-all duration-200 z-[99999]" style="pointer-events: auto; display: none;">

                                    <div class="js-close-btn absolute -top-3 -right-3 w-10 h-10 flex items-center justify-center cursor-pointer z-[100]">
                                        <div class="w-7 h-7 bg-black border border-zinc-600 rounded-full flex items-center justify-center text-zinc-300 hover:text-white hover:bg-zinc-800 hover:scale-110 transition-all shadow-lg">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                        </div>
                                    </div>

                                    <div class="px-5 py-3 border-b border-zinc-800 bg-zinc-900/50 rounded-t-xl">
                                        <div class="flex items-center justify-between">
                                            <span class="text-xs font-mono uppercase tracking-widest text-cyan-400 truncate max-w-[140px]">
                                                ${
																									d.displayName
																										? d.displayName.split(
																												" "
																										  )[0]
																										: "ANÓNIMO"
																								}
                                            </span>
                                            <span class="px-2 py-0.5 rounded-full text-[9px] uppercase font-bold tracking-wider ${categoryClass}">
                                                ${category}
                                            </span>
                                        </div>
                                        <span class="text-[10px] text-zinc-500 font-mono mt-1 flex items-center gap-1">
                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                                            ${locationText}
                                        </span>
                                    </div>
                                    <div class="p-5 cursor-default">
                                        <p class="text-sm text-zinc-200 font-light leading-relaxed italic">"${finalMessage}"</p>
                                    </div>
                                    <button class="js-profile-btn w-full py-3 bg-black hover:bg-zinc-900 border-t border-zinc-800 text-[10px] text-cyan-500 uppercase tracking-widest transition-colors cursor-pointer flex items-center justify-center gap-2 rounded-b-xl">
                                        VER PERFIL COMPLETO
                                    </button>

                                    <div class="absolute -bottom-1.5 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-zinc-950 border-r border-b border-zinc-800 rotate-45"></div>
                                </div>

                                <div class="js-icon-container cursor-pointer group relative z-10" style="pointer-events: auto;">
                                    <img src="${photo}" class="js-marker-photo w-10 h-10 rounded-full object-cover border-2 border-cyan-500 transition-all duration-200 hover:border-white bg-black shadow-lg" />
                                </div>
                            </div>
                        `;

						const killEvent = (e) => {
							e.stopPropagation();
							e.stopImmediatePropagation();
						};
						const iconContainer = wrapper.querySelector(".js-icon-container");
						const popup = wrapper.querySelector(".js-popup");
						const btn = wrapper.querySelector(".js-profile-btn");
						const closeBtn = wrapper.querySelector(".js-close-btn");

						[iconContainer, popup, closeBtn].forEach((el) => {
							if (!el) return;
							el.addEventListener("mousedown", killEvent);
							el.addEventListener("pointerdown", killEvent);
							el.addEventListener("touchstart", killEvent);
						});

						iconContainer.addEventListener("click", (e) => {
							killEvent(e);
							const data = wrapper.__data;
							if (data) {
								setSelectedThoughtId(data.id);
								// IMPORTANTE: También intentamos zoom aquí por si clicamos la foto y no el punto
								handleSmartZoom(data.location.lat, data.location.lon);
							}
						});

						if (closeBtn) {
							closeBtn.addEventListener("click", (e) => {
								e.preventDefault();
								e.stopPropagation();
								setSelectedThoughtId(null);
							});
							closeBtn.addEventListener("touchend", (e) => {
								e.preventDefault();
								e.stopPropagation();
								setSelectedThoughtId(null);
							});
						}

						if (btn) {
							btn.addEventListener("click", (e) => {
								killEvent(e);
								if (wrapper.__data && openProfile) openProfile(wrapper.__data);
							});
						}
						markersRef.current[d.id] = wrapper;
					}

					const el = markersRef.current[d.id];
					el.__data = d;
					const popupEl = el.querySelector(".js-popup");
					const photoEl = el.querySelector(".js-marker-photo");
					const isSelected = d.id === selectedThoughtId;
					const isAnySelected = selectedThoughtId !== null;

					if (isSelected) {
						el.style.zIndex = "99999";
						el.style.opacity = "1";
						el.style.pointerEvents = "auto";
						if (popupEl) popupEl.style.display = "block";
						if (photoEl) {
							photoEl.classList.add("border-white");
							photoEl.classList.remove("border-cyan-500");
						}
					} else if (isAnySelected) {
						el.style.zIndex = "0";
						el.style.opacity = "0";
						el.style.pointerEvents = "none";
						if (popupEl) popupEl.style.display = "none";
					} else {
						el.style.zIndex = "10";
						el.style.opacity = "1";
						el.style.pointerEvents = "auto";
						if (popupEl) popupEl.style.display = "none";
						if (photoEl) {
							photoEl.classList.remove("border-white");
							photoEl.classList.add("border-cyan-500");
						}
					}
					return el;
				}}
			/>
		</div>
	);
};
