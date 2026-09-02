import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

gsap.registerPlugin(useGSAP);

const PUBLIC_BASE_URL = import.meta.env.BASE_URL || '/';
const MODEL_URL = `${PUBLIC_BASE_URL}landing-media/models/featured-pet.glb`;
const DRACO_DECODER_PATH = `${PUBLIC_BASE_URL}landing-media/draco/`;
const PET_FALLBACK_URL = `${PUBLIC_BASE_URL}landing-media/pet-ensemble.png`;
const FLOOR_TOP = -1.02;
const PET_ACCENTS = {
    dog: 0x93c5fd,
    cat: 0xf08a73,
    parrot: 0x60a5fa,
    bunny: 0xf6c85f,
};

function addMesh(parent, name, geometry, material, position, scale = [1, 1, 1], rotation = [0, 0, 0]) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    mesh.rotation.set(...rotation);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
}

function prepareImportedModel(model, renderer, enableShadows) {
    model.traverse((object) => {
        if (!object.isMesh) return;

        object.castShadow = enableShadows;
        object.receiveShadow = true;
        const materials = Array.isArray(object.material) ? object.material : [object.material];

        materials.filter(Boolean).forEach((material) => {
            material.envMapIntensity = Math.max(material.envMapIntensity || 0, 0.9);
            Object.values(material).forEach((value) => {
                if (!value?.isTexture) return;
                value.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
                value.needsUpdate = true;
            });
        });
    });
}

function fitImportedModel(model) {
    model.updateMatrixWorld(true);
    const initialBox = new THREE.Box3().setFromObject(model);
    const initialSize = initialBox.getSize(new THREE.Vector3());
    const targetHeight = 2.3;
    const uniformScale = targetHeight / Math.max(initialSize.y, 0.001);

    model.scale.multiplyScalar(uniformScale);
    model.updateMatrixWorld(true);

    const fittedBox = new THREE.Box3().setFromObject(model);
    const fittedCenter = fittedBox.getCenter(new THREE.Vector3());
    model.position.x -= fittedCenter.x;
    model.position.y += FLOOR_TOP - fittedBox.min.y;
    model.position.z -= fittedCenter.z;
    model.updateMatrixWorld(true);
}

function disposeObject(root) {
    const geometries = new Set();
    const materials = new Set();
    const textures = new Set();

    root?.traverse?.((object) => {
        if (object.geometry) geometries.add(object.geometry);
        const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
        objectMaterials.filter(Boolean).forEach((material) => {
            materials.add(material);
            Object.values(material).forEach((value) => {
                if (value?.isTexture) textures.add(value);
            });
        });
    });

    textures.forEach((texture) => texture.dispose());
    materials.forEach((material) => material.dispose());
    geometries.forEach((geometry) => geometry.dispose());
}

export default function PetStage({ activePet = 'dog' }) {
    const containerRef = useRef(null);
    const canvasRef = useRef(null);
    const activePetRef = useRef(activePet);
    const [isReady, setIsReady] = useState(false);
    const [loadProgress, setLoadProgress] = useState(0);

    useEffect(() => {
        activePetRef.current = activePet;
    }, [activePet]);

    useGSAP((context, contextSafe) => {
        void context;
        const container = containerRef.current;
        const canvas = canvasRef.current;
        if (!container || !canvas) return undefined;

        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const highPerformanceDevice = (navigator.hardwareConcurrency || 8) > 4;
        const enableShadows = highPerformanceDevice;
        let renderer;
        let animationFrame = 0;
        let isDisposed = false;
        let isVisible = true;
        let environmentTexture;
        let roomEnvironment;
        let entrance;
        let lastReportedProgress = 0;
        const pointer = { x: 0, y: 0 };
        const targetColor = new THREE.Color(PET_ACCENTS[activePetRef.current]);
        const timer = new THREE.Timer();
        timer.connect(document);

        try {
            renderer = new THREE.WebGLRenderer({
                canvas,
                alpha: true,
                antialias: highPerformanceDevice,
                powerPreference: 'high-performance',
            });
        } catch {
            setIsReady(false);
            return undefined;
        }

        const pixelRatioCap = highPerformanceDevice ? 1.65 : 1.2;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pixelRatioCap));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.1;
        renderer.shadowMap.enabled = enableShadows;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(31, 1, 0.1, 50);
        camera.position.set(0, 0.18, 5.35);
        camera.lookAt(0, 0.02, 0);

        const environmentGenerator = new THREE.PMREMGenerator(renderer);
        roomEnvironment = new RoomEnvironment();
        environmentTexture = environmentGenerator.fromScene(roomEnvironment, 0.035).texture;
        scene.environment = environmentTexture;
        environmentGenerator.dispose();

        const stage = new THREE.Group();
        const entranceRig = new THREE.Group();
        const motionRig = new THREE.Group();
        entranceRig.add(motionRig);
        stage.add(entranceRig);
        scene.add(stage);

        const hemisphereLight = new THREE.HemisphereLight(0xeaf3ff, 0x102a56, 1.8);
        scene.add(hemisphereLight);

        const keyLight = new THREE.DirectionalLight(0xfff1df, 5.1);
        keyLight.position.set(-3.4, 5.2, 4.8);
        keyLight.castShadow = enableShadows;
        keyLight.shadow.mapSize.set(highPerformanceDevice ? 1024 : 512, highPerformanceDevice ? 1024 : 512);
        keyLight.shadow.bias = -0.00035;
        keyLight.shadow.normalBias = 0.025;
        keyLight.shadow.camera.left = -3;
        keyLight.shadow.camera.right = 3;
        keyLight.shadow.camera.top = 3;
        keyLight.shadow.camera.bottom = -3;
        scene.add(keyLight);

        const fillLight = new THREE.PointLight(0x93c5fd, 9.2, 9, 1.7);
        fillLight.position.set(3.2, 1.3, 3.5);
        scene.add(fillLight);

        const rimLight = new THREE.SpotLight(0x60a5fa, 18, 10, Math.PI / 5, 0.65, 1.5);
        rimLight.position.set(2.5, 3.2, -1.8);
        rimLight.target.position.set(0, 0.4, 0);
        scene.add(rimLight, rimLight.target);

        const floor = addMesh(
            stage,
            'studio-plinth',
            new THREE.CylinderGeometry(2.45, 2.68, 0.18, highPerformanceDevice ? 96 : 64),
            new THREE.MeshPhysicalMaterial({
                color: 0x12356b,
                roughness: 0.48,
                metalness: 0.03,
                clearcoat: 0.42,
                clearcoatRoughness: 0.32,
            }),
            [0, -1.11, 0],
        );
        floor.receiveShadow = true;

        const contactShadow = addMesh(
            stage,
            'contact-shadow',
            new THREE.CircleGeometry(1.35, highPerformanceDevice ? 72 : 48),
            new THREE.MeshBasicMaterial({
                color: 0x071225,
                transparent: true,
                opacity: 0.3,
                depthWrite: false,
            }),
            [0, -1.008, 0.14],
            [1.3, 0.64, 1],
            [-Math.PI / 2, 0, 0],
        );
        contactShadow.castShadow = false;

        const haloMaterial = new THREE.MeshBasicMaterial({
            color: PET_ACCENTS[activePetRef.current],
            transparent: true,
            opacity: 0.34,
        });
        const halo = addMesh(
            stage,
            'pet-halo',
            new THREE.TorusGeometry(1.88, 0.012, 8, highPerformanceDevice ? 160 : 96),
            haloMaterial,
            [0, 0.05, -0.62],
        );
        halo.castShadow = false;

        const renderScene = () => {
            if (!isDisposed) renderer.render(scene, camera);
        };

        const resize = () => {
            const width = Math.max(container.clientWidth, 1);
            const height = Math.max(container.clientHeight, 1);
            renderer.setSize(width, height, false);
            camera.aspect = width / height;
            camera.position.z = camera.aspect < 0.86 ? 6.15 : 5.35;
            camera.updateProjectionMatrix();
            camera.lookAt(0, 0.02, 0);
            if (reduceMotion) renderScene();
        };

        const handlePointerMove = (event) => {
            const bounds = container.getBoundingClientRect();
            pointer.x = THREE.MathUtils.clamp(((event.clientX - bounds.left) / bounds.width - 0.5) * 2, -1, 1);
            pointer.y = THREE.MathUtils.clamp(((event.clientY - bounds.top) / bounds.height - 0.5) * 2, -1, 1);
        };

        const handlePointerLeave = () => {
            pointer.x = 0;
            pointer.y = 0;
        };

        const render = (timestamp) => {
            animationFrame = 0;
            if (isDisposed || !isVisible || document.hidden) return;

            timer.update(timestamp);
            const elapsed = timer.getElapsed();
            targetColor.setHex(PET_ACCENTS[activePetRef.current] || PET_ACCENTS.dog);
            haloMaterial.color.lerp(targetColor, 0.07);

            motionRig.rotation.y += (pointer.x * 0.16 - motionRig.rotation.y) * 0.055;
            motionRig.rotation.x += (-pointer.y * 0.035 - motionRig.rotation.x) * 0.055;
            motionRig.position.y = Math.sin(elapsed * 1.3) * 0.018;
            halo.rotation.z = elapsed * 0.035;

            renderScene();
            animationFrame = window.requestAnimationFrame(render);
        };

        const startRendering = () => {
            if (!reduceMotion && !animationFrame && !document.hidden && isVisible) {
                animationFrame = window.requestAnimationFrame(render);
            }
        };

        const handleModelLoaded = contextSafe((gltf) => {
            if (isDisposed) {
                disposeObject(gltf.scene);
                return;
            }

            const importedModel = gltf.scene;
            importedModel.name = 'featured-pet-model';
            prepareImportedModel(importedModel, renderer, enableShadows);
            fitImportedModel(importedModel);
            motionRig.add(importedModel);

            entranceRig.position.y = -0.12;
            entranceRig.rotation.y = -0.18;
            entranceRig.scale.setScalar(0.86);

            entrance = gsap.timeline({ defaults: { ease: 'power3.out' } });
            entrance
                .to(entranceRig.scale, {
                    x: 1,
                    y: 1,
                    z: 1,
                    duration: reduceMotion ? 0 : 0.68,
                }, 0)
                .to(entranceRig.position, {
                    y: 0,
                    duration: reduceMotion ? 0 : 0.62,
                }, 0)
                .to(entranceRig.rotation, {
                    y: 0,
                    duration: reduceMotion ? 0 : 0.72,
                }, 0)
                .fromTo(floor.scale, {
                    x: 0.84,
                    z: 0.84,
                }, {
                    x: 1,
                    z: 1,
                    duration: reduceMotion ? 0 : 0.52,
                }, reduceMotion ? 0 : 0.08)
                .fromTo(haloMaterial, {
                    opacity: 0,
                }, {
                    opacity: 0.34,
                    duration: reduceMotion ? 0 : 0.46,
                }, reduceMotion ? 0 : 0.18);

            setLoadProgress(100);
            setIsReady(true);
            renderScene();
            startRendering();
        });

        const handleModelError = contextSafe(() => {
            if (isDisposed) return;
            setIsReady(false);
            setLoadProgress(0);
        });

        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath(DRACO_DECODER_PATH);
        dracoLoader.setWorkerLimit(2);

        const modelLoader = new GLTFLoader();
        modelLoader.setDRACOLoader(dracoLoader);
        modelLoader.load(
            MODEL_URL,
            handleModelLoaded,
            (event) => {
                if (isDisposed || !event.total) return;
                const nextProgress = Math.min(99, Math.round((event.loaded / event.total) * 100));
                if (nextProgress < lastReportedProgress + 5) return;
                lastReportedProgress = nextProgress;
                setLoadProgress(nextProgress);
            },
            handleModelError,
        );

        const resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(container);

        const visibilityObserver = new IntersectionObserver(([entry]) => {
            isVisible = entry.isIntersecting;
            if (isVisible) startRendering();
            else if (animationFrame) {
                window.cancelAnimationFrame(animationFrame);
                animationFrame = 0;
            }
        }, { threshold: 0.04 });
        visibilityObserver.observe(container);

        const handleVisibilityChange = () => {
            if (document.hidden && animationFrame) {
                window.cancelAnimationFrame(animationFrame);
                animationFrame = 0;
            } else {
                startRendering();
            }
        };

        if (!reduceMotion) {
            container.addEventListener('pointermove', handlePointerMove);
            container.addEventListener('pointerleave', handlePointerLeave);
        }
        document.addEventListener('visibilitychange', handleVisibilityChange);
        resize();
        renderScene();

        return () => {
            isDisposed = true;
            entrance?.kill();
            if (animationFrame) window.cancelAnimationFrame(animationFrame);
            resizeObserver.disconnect();
            visibilityObserver.disconnect();
            container.removeEventListener('pointermove', handlePointerMove);
            container.removeEventListener('pointerleave', handlePointerLeave);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            timer.dispose();
            dracoLoader.dispose();
            disposeObject(scene);
            environmentTexture?.dispose();
            roomEnvironment?.dispose?.();
            renderer.dispose();
        };
    }, { scope: containerRef });

    return (
        <div ref={containerRef} className="landing-pet-stage" aria-label="Interactive high-detail 3D veterinary pet">
            <img
                src={PET_FALLBACK_URL}
                alt="Dogs, a cat, a parrot, and a rabbit"
                className={`landing-pet-fallback ${isReady ? 'landing-pet-fallback--hidden' : ''}`}
            />
            <canvas
                ref={canvasRef}
                className={`landing-pet-canvas ${isReady ? 'landing-pet-canvas--ready' : ''}`}
                aria-hidden="true"
            />
            <div className="landing-pet-hint" aria-hidden="true">
                <span className="landing-pet-hint__dot" />
                {isReady ? 'Move to greet our 3D patient' : `Preparing 3D patient${loadProgress ? ` · ${loadProgress}%` : ''}`}
            </div>
        </div>
    );
}

PetStage.propTypes = {
    activePet: PropTypes.oneOf(['dog', 'cat', 'parrot', 'bunny']),
};
