import React, { useState, useEffect, useRef, useMemo } from "react";
import { User, MapPin, MessageCircle } from "lucide-react";

const GOOGLE_TILES_URL = (x, y, z) =>
	`https://mt1.google.com/vt/lyrs=s&x=${x}&y=${y}&z=${z}`;

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
			// OPTIMIZACIÓN: Capar la resolución a 2x máximo (evita lag en móviles Retina)
			renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
			renderer.antialias = true;

			const controls = globe.controls();
			controls.autoRotate = false;
			controls.enableZoom = true;
			controls.dampingFactor = 0.1;
			controls.minDistance = globe.getGlobeRadius() * 1.01;
			controls.maxDistance = globe.getGlobeRadius() * 9;

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

	const handleSmartZoom = (lat, lng) => {
		if (!globeEl.current) return;
		const currentPov = globeEl.current.pointOfView();
		const targetAltitude =
			currentPov.altitude > 0.6 ? 0.35 : currentPov.altitude;
		globeEl.current.pointOfView(
			{ lat: lat, lng: lng, altitude: targetAltitude },
			1200
		);
	};

	const mapData = useMemo(() => {
		return messages
			.filter((m) => m.location?.lat && m.location?.lon)
			.map((m) => ({ ...m, isSelected: m.id === selectedThoughtId }))
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
				atmosphereAltitude={0.1}
				htmlTransitionDuration={0}
				animateIn={false}
				pointsData={mapData}
				pointLat={(d) => d.location.lat}
				pointLng={(d) => d.location.lon}
				pointAltitude={0.001}
				pointRadius={1.5}
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
						wrapper.className =
							"flex flex-col items-center justify-end transform -translate-x-1/2 -translate-y-[100%]";
						wrapper.style.pointerEvents = "none";

						const category = d.category
							? String(d.category).toUpperCase()
							: "GENERAL";
						const categoryClass =
							CATEGORY_COLORS[category] || CATEGORY_COLORS["GENERAL"];
						const photo =
							d.photoURL ||
							"https://abs.twimg.com/sticky/default_profile_images/default_profile_400x400.png";

						// OPTIMIZACIÓN: Quitados 'backdrop-blur', sombras pesadas y efectos 'glow' constantes
						wrapper.innerHTML = `
                            <div class="js-popup absolute bottom-[115%] mb-2 w-72 bg-zinc-950 border border-zinc-800 rounded-lg shadow-lg origin-bottom transition-all duration-200 overflow-hidden" style="pointer-events: auto; display: none;">
                                <div class="px-4 py-3 flex items-start gap-3 border-b border-zinc-800 bg-zinc-900/50">
                                    <img src="${photo}" class="w-8 h-8 rounded-full border border-cyan-500/50 object-cover bg-black" />
                                    <div class="flex-1 min-w-0">
                                        <div class="flex items-center justify-between">
                                            <span class="text-xs font-mono uppercase tracking-widest text-cyan-400 truncate max-w-[120px]">
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
                                    </div>
                                </div>
                                <div class="p-4">
                                    <p class="text-sm text-zinc-200 font-light leading-relaxed italic">"${
																			d.text
																		}"</p>
                                </div>
                                <button class="js-profile-btn w-full py-2 bg-black hover:bg-zinc-900 border-t border-zinc-800 text-[10px] text-cyan-500 uppercase tracking-widest transition-colors cursor-pointer flex items-center justify-center gap-2">
                                    VER PERFIL
                                </button>
                                <div class="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-zinc-950 border-r border-b border-zinc-800 rotate-45"></div>
                            </div>

                            <div class="js-icon-container cursor-pointer group relative" style="pointer-events: auto;">
                                <img src="${photo}" class="js-marker-photo relative w-9 h-9 rounded-full object-cover border-2 border-cyan-500 transition-all duration-200 hover:scale-110 hover:border-white z-10 bg-black" />
                            </div>
                        `;

						const stopProp = (e) => e.stopPropagation();
						const iconContainer = wrapper.querySelector(".js-icon-container");
						const popup = wrapper.querySelector(".js-popup");
						const btn = wrapper.querySelector(".js-profile-btn");

						iconContainer.addEventListener("mousedown", stopProp);
						if (popup) popup.addEventListener("mousedown", stopProp);

						iconContainer.addEventListener("click", (e) => {
							e.stopPropagation();
							const data = wrapper.__data;
							if (data) {
								setSelectedThoughtId(data.id);
								handleSmartZoom(data.location.lat, data.location.lon);
							}
						});

						if (btn) {
							btn.addEventListener("click", (e) => {
								e.stopPropagation();
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

					if (isSelected) {
						el.style.zIndex = "9999";
						if (popupEl) popupEl.style.display = "block";
						if (photoEl) {
							photoEl.classList.add("scale-125", "border-white");
							photoEl.classList.remove("border-cyan-500");
						}
					} else {
						el.style.zIndex = "10";
						if (popupEl) popupEl.style.display = "none";
						if (photoEl) {
							photoEl.classList.remove("scale-125", "border-white");
							photoEl.classList.add("border-cyan-500");
						}
					}

					return el;
				}}
			/>
		</div>
	);
};
