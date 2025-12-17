// File: alejandro-m-p/aether-project/aether-project-main/src/components/react/MapComponent.jsx

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useStore } from "@nanostores/react";
import { isPickingLocation, pickedCoordinates } from "../../store.js";

const GOOGLE_TILES_URL = (x, y, z) =>
	`https://mt1.google.com/vt/lyrs=s&x=${x}&y=${y}&z=${z}`;

const DEFAULT_AVATAR =
	"https://cdn-icons-png.flaticon.com/512/3214/3214823.png";

const CATEGORY_COLORS = {
	IDEAS: "#fbbf24",
	NOTICIAS: "#c084fc",
	GENERAL: "#22d3ee",
};

const MAX_TEXT_LENGTH = 300;

// Iconos SVG
const ICON_THUMBS_UP = `
<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z"/></svg>
`;

const ICON_THUMBS_DOWN = `
<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 14V2"/><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a3.13 3.13 0 0 1-3-3.88Z"/></svg>
`;

export const MapComponent = ({ messages = [], openProfile, onVote }) => {
	const globeEl = useRef();
	const [GlobePackage, setGlobePackage] = useState(null);
	const [ThreePackage, setThreePackage] = useState(null);
	const $isPicking = useStore(isPickingLocation);
	const [selectedThoughtId, setSelectedThoughtId] = useState(null);
	const [readThoughtIds, setReadThoughtIds] = useState(new Set());
	const [dimensions, setDimensions] = useState({ width: 800, height: 800 });
	const [globeReady, setGlobeReady] = useState(false);
	const markersRef = useRef({});

	useEffect(() => {
		if (typeof window !== "undefined") {
			Promise.all([import("react-globe.gl"), import("three")]).then(
				([globeMod, threeMod]) => {
					setGlobePackage(() => globeMod.default?.default || globeMod.default);
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
			controls.minDistance = globe.getGlobeRadius() * 1.001;
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

	const handleSmartZoom = (lat, lng) => {
		if (!globeEl.current) return;
		const currentPov = globeEl.current.pointOfView();
		const targetAltitude =
			currentPov.altitude > 0.25 ? 0.08 : currentPov.altitude;
		globeEl.current.pointOfView({ lat, lng, altitude: targetAltitude }, 1000);
	};

	const mapData = useMemo(() => {
		if ($isPicking) return [];
		if (selectedThoughtId) {
			const selected = messages.find((m) => m.id === selectedThoughtId);
			if (selected) {
				return [
					{
						...selected,
						isSelected: true,
						isRead: readThoughtIds.has(selected.id),
					},
				];
			}
		}
		return messages
			.filter((m) => m.location?.lat && m.location?.lon)
			.map((m) => ({
				...m,
				isSelected: false,
				isRead: readThoughtIds.has(m.id),
			}))
			.reverse();
	}, [messages, selectedThoughtId, $isPicking, readThoughtIds]);

	const getLocationText = (d) => {
		const city = d.cityName;
		if (city && city !== "undefined" && city !== "null" && city.trim() !== "")
			return city;
		return d.countryName || "Localizado";
	};

	if (!GlobePackage) return <div className="w-full h-full bg-[#0a0a0a]" />;
	const Globe = GlobePackage;

	return (
		<div
			className={`relative w-full h-full bg-[#0a0a0a] select-none ${
				$isPicking ? "cursor-crosshair" : "cursor-move"
			}`}
		>
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
				pointsData={[]}
				onGlobeClick={({ lat, lng }) => {
					if ($isPicking) {
						pickedCoordinates.set({ lat, lng });
						isPickingLocation.set(false);
						handleSmartZoom(lat, lng);
					} else {
						setSelectedThoughtId(null);
					}
				}}
				htmlElementsData={mapData}
				htmlLat={(d) => d.location.lat}
				htmlLng={(d) => d.location.lon}
				htmlAltitude={0}
				htmlElement={(d) => {
					// 1. CREACIÓN (Initial Render)
					if (!markersRef.current[d.id]) {
						const wrapper = document.createElement("div");
						wrapper.style.position = "absolute";
						wrapper.style.transform = "translate(-50%, -50%)";
						wrapper.style.pointerEvents = "none";
						wrapper.style.display = "flex";
						wrapper.style.flexDirection = "column";
						wrapper.style.alignItems = "center";
						wrapper.style.justifyContent = "center";
						wrapper.style.zIndex = "10";

						const category = d.category
							? String(d.category).toUpperCase()
							: "GENERAL";
						const color =
							CATEGORY_COLORS[category] || CATEGORY_COLORS["GENERAL"];
						const photo =
							d.photoURL && d.photoURL.length > 5 ? d.photoURL : DEFAULT_AVATAR;
						const locationText = getLocationText(d);

						const finalMessage = d.text || d.message || "";
						const isLong = finalMessage.length > MAX_TEXT_LENGTH;
						const displayMessage = isLong
							? finalMessage.slice(0, MAX_TEXT_LENGTH) + "..."
							: finalMessage;

						wrapper.innerHTML = `
                            <div style="position: relative; display: flex; align-items: center; justify-content: center;">
                                <div class="js-popup" style="
                                    display: none; position: absolute; bottom: 50px; width: 320px;
                                    background-color: #09090b; border: 1px solid #27272a; border-radius: 20px;
                                    pointer-events: auto; cursor: default; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.8);
                                    z-index: 1000; flex-direction: column;
                                ">
                                    <div class="js-close-btn" style="
                                        position: absolute; top: -10px; right: -10px; width: 30px; height: 30px;
                                        background: black; border: 1px solid #52525b; border-radius: 50%;
                                        display: flex; align-items: center; justify-content: center; color: white; cursor: pointer; z-index: 1001;
                                    ">✕</div>

                                    <div style="padding: 12px 20px; border-bottom: 1px solid #27272a; background: rgba(24, 24, 27, 0.5); border-top-left-radius: 20px; border-top-right-radius: 20px; flex-shrink: 0;">
                                        <div style="display: flex; justify-content: space-between; align-items: center;">
                                            <span class="js-display-name-btn" style="font-size: 10px; color: #22d3ee; font-family: monospace; text-transform: uppercase; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 150px; cursor: pointer; text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 2px;">
                                                ${
																									d.displayName
																										? d.displayName.split(
																												" "
																										  )[0]
																										: "ANÓNIMO"
																								}
                                            </span>
                                            <span style="font-size: 9px; padding: 2px 6px; border-radius: 999px; background: ${color}20; color: ${color}; font-weight: bold;">
                                                ${category}
                                            </span>
                                        </div>
                                        <div style="font-size: 10px; color: #71717a; margin-top: 4px; font-family: monospace;">
                                            📍 ${locationText}
                                        </div>
                                    </div>

                                    <div style="padding: 20px; max-height: 350px; overflow-y: auto; scrollbar-width: thin; scrollbar-color: #27272a transparent;">
                                        <p class="js-message-text" style="font-size: 14px; color: #e4e4e7; font-style: italic; margin: 0; line-height: 1.6; white-space: pre-wrap; overflow-wrap: break-word; word-wrap: break-word; user-select: text;">${displayMessage}</p>
										${
											isLong
												? `<div class="js-read-more" style="margin-top: 12px; color: #22d3ee; font-size: 10px; font-weight: bold; text-transform: uppercase; cursor: pointer; letter-spacing: 1px; padding: 4px 0; border: 1px solid #22d3ee80; background: #22d3ee10; border-radius: 999px; width: 120px; text-align: center; margin-left: auto; margin-right: auto;">+ Leer todo</div>`
												: ""
										}

                                        <div style="display: flex; gap: 10px; margin-top: 20px; border-top: 1px solid #27272a; padding-top: 15px;">
                                            <button class="js-like-btn" style="
                                                flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px;
                                                padding: 8px; background: #18181b; border: 1px solid #3f3f46; border-radius: 999px;
                                                color: #a1a1aa; font-family: monospace; font-size: 11px; cursor: pointer; transition: all 0.2s;
                                            ">
                                                ${ICON_THUMBS_UP}
                                                <span class="js-like-count" style="font-weight: bold;">0</span>
                                            </button>

                                            <button class="js-dislike-btn" style="
                                                flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px;
                                                padding: 8px; background: #18181b; border: 1px solid #3f3f46; border-radius: 999px;
                                                color: #a1a1aa; font-family: monospace; font-size: 11px; cursor: pointer; transition: all 0.2s;
                                            ">
                                                ${ICON_THUMBS_DOWN}
                                                <span class="js-dislike-count" style="font-weight: bold;">0</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div class="js-icon-container" style="position: relative; width: 40px; height: 40px; z-index: 10; pointer-events: auto; cursor: pointer;">
                                    <img src="${photo}" class="js-photo" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover; border: 2px solid #22d3ee; background: black; display: block; box-shadow: 0 0 10px rgba(0,0,0,0.5); transition: transform 0.2s, border-color 0.2s;" />
                                </div>
                            </div>
                        `;

						const preventMapDrag = (e) => e.stopPropagation();

						// LISTENERS
						const likeBtn = wrapper.querySelector(".js-like-btn");
						const dislikeBtn = wrapper.querySelector(".js-dislike-btn");
						const likeCountEl = wrapper.querySelector(".js-like-count");
						const dislikeCountEl = wrapper.querySelector(".js-dislike-count");

						const readMoreBtn = wrapper.querySelector(".js-read-more");
						const iconContainer = wrapper.querySelector(".js-icon-container");
						const closeBtn = wrapper.querySelector(".js-close-btn");
						const displayNameBtn = wrapper.querySelector(
							".js-display-name-btn"
						);

						// --- OPTIMISTIC UI LOGIC (Feedback instantáneo) ---
						if (likeBtn)
							likeBtn.onclick = (e) => {
								e.stopPropagation();

								// Actualización visual inmediata
								const isLiked = likeBtn.style.color === "rgb(34, 211, 238)"; // #22d3ee
								const isDisliked =
									dislikeBtn.style.color === "rgb(248, 113, 113)"; // #f87171

								if (isLiked) {
									// Toggle OFF
									likeBtn.style.color = "#a1a1aa";
									likeBtn.style.borderColor = "#3f3f46";
									likeBtn.style.background = "#18181b";
									likeCountEl.innerText = Math.max(
										0,
										parseInt(likeCountEl.innerText) - 1
									);
								} else {
									// Toggle ON
									likeBtn.style.color = "#22d3ee";
									likeBtn.style.borderColor = "#22d3ee50";
									likeBtn.style.background = "#22d3ee10";
									likeCountEl.innerText = parseInt(likeCountEl.innerText) + 1;

									// Remove Dislike if active
									if (isDisliked) {
										dislikeBtn.style.color = "#a1a1aa";
										dislikeBtn.style.borderColor = "#3f3f46";
										dislikeBtn.style.background = "#18181b";
										dislikeCountEl.innerText = Math.max(
											0,
											parseInt(dislikeCountEl.innerText) - 1
										);
									}
								}

								if (onVote) onVote(d.id, "likes");
							};

						if (dislikeBtn)
							dislikeBtn.onclick = (e) => {
								e.stopPropagation();

								// Actualización visual inmediata
								const isDisliked =
									dislikeBtn.style.color === "rgb(248, 113, 113)"; // #f87171
								const isLiked = likeBtn.style.color === "rgb(34, 211, 238)"; // #22d3ee

								if (isDisliked) {
									// Toggle OFF
									dislikeBtn.style.color = "#a1a1aa";
									dislikeBtn.style.borderColor = "#3f3f46";
									dislikeBtn.style.background = "#18181b";
									dislikeCountEl.innerText = Math.max(
										0,
										parseInt(dislikeCountEl.innerText) - 1
									);
								} else {
									// Toggle ON
									dislikeBtn.style.color = "#f87171";
									dislikeBtn.style.borderColor = "#f8717150";
									dislikeBtn.style.background = "#f8717110";
									dislikeCountEl.innerText =
										parseInt(dislikeCountEl.innerText) + 1;

									// Remove Like if active
									if (isLiked) {
										likeBtn.style.color = "#a1a1aa";
										likeBtn.style.borderColor = "#3f3f46";
										likeBtn.style.background = "#18181b";
										likeCountEl.innerText = Math.max(
											0,
											parseInt(likeCountEl.innerText) - 1
										);
									}
								}

								if (onVote) onVote(d.id, "dislikes");
							};
						// --------------------------------------------------

						if (readMoreBtn)
							readMoreBtn.onclick = (e) => {
								e.stopPropagation();
								const textEl = wrapper.querySelector(".js-message-text");
								if (textEl) {
									textEl.innerText = finalMessage;
									readMoreBtn.style.display = "none";
								}
							};

						if (iconContainer)
							iconContainer.onclick = (e) => {
								e.stopPropagation();
								setReadThoughtIds((prev) => new Set(prev).add(d.id));
								setSelectedThoughtId(d.id);
								handleSmartZoom(d.location.lat, d.location.lon);
							};

						if (displayNameBtn)
							displayNameBtn.onclick = (e) => {
								e.stopPropagation();
								openProfile({
									uid: d.uid,
									displayName: d.displayName,
									photoURL: d.photoURL,
								});
							};

						if (closeBtn)
							closeBtn.onclick = (e) => {
								e.stopPropagation();
								setSelectedThoughtId(null);
							};

						const interactables = [
							wrapper.querySelector(".js-popup"),
							iconContainer,
							closeBtn,
							readMoreBtn,
							wrapper.querySelector(".js-message-text"),
							displayNameBtn,
							likeBtn,
							dislikeBtn,
						];
						interactables.forEach((el) => {
							if (el) {
								el.addEventListener("pointerdown", preventMapDrag);
								el.addEventListener("mousedown", preventMapDrag);
								el.addEventListener("touchstart", preventMapDrag);
							}
						});

						markersRef.current[d.id] = wrapper;
					}

					// 2. ACTUALIZACIÓN (Render loop)
					const el = markersRef.current[d.id];

					// Sincronización real con el servidor (eventual consistency)
					// Sobrescribe el estado optimista con el real cuando llega
					const likeCountEl = el.querySelector(".js-like-count");
					if (likeCountEl) likeCountEl.innerText = d.likes || 0;

					const dislikeCountEl = el.querySelector(".js-dislike-count");
					if (dislikeCountEl) dislikeCountEl.innerText = d.dislikes || 0;

					const likeBtn = el.querySelector(".js-like-btn");
					const dislikeBtn = el.querySelector(".js-dislike-btn");

					if (likeBtn) {
						if (d.isLiked) {
							likeBtn.style.color = "#22d3ee";
							likeBtn.style.borderColor = "#22d3ee50";
							likeBtn.style.background = "#22d3ee10";
						} else {
							likeBtn.style.color = "#a1a1aa";
							likeBtn.style.borderColor = "#3f3f46";
							likeBtn.style.background = "#18181b";
						}
					}
					if (dislikeBtn) {
						if (d.isDisliked) {
							dislikeBtn.style.color = "#f87171";
							dislikeBtn.style.borderColor = "#f8717150";
							dislikeBtn.style.background = "#f8717110";
						} else {
							dislikeBtn.style.color = "#a1a1aa";
							dislikeBtn.style.borderColor = "#3f3f46";
							dislikeBtn.style.background = "#18181b";
						}
					}

					const popupEl = el.querySelector(".js-popup");
					const photoImg = el.querySelector(".js-photo");
					const isSelected = d.id === selectedThoughtId;

					if (isSelected) {
						el.style.zIndex = "99999999";
						if (popupEl) popupEl.style.display = "flex";
						if (photoImg) {
							photoImg.style.borderColor = "white";
							photoImg.style.transform = "scale(1.2)";
						}
					} else {
						el.style.zIndex = "10";
						if (popupEl) popupEl.style.display = "none";
						if (photoImg) {
							photoImg.style.transform = "scale(1)";
							photoImg.style.borderColor = d.isRead ? "#52525b" : "#22d3ee";
						}
					}
					return el;
				}}
			/>
		</div>
	);
};
