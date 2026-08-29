// Archived with the discarded modern landing page for possible future reuse.
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const PETS = [
    { file: 'animal-dog.glb', position: [-1.55, -0.75, 0], scale: 1.2, rotation: 0.18 },
    { file: 'animal-cat.glb', position: [-0.45, -0.75, 0.18], scale: 1, rotation: 0.05 },
    { file: 'animal-parrot.glb', position: [0.72, -0.68, 0.12], scale: 0.88, rotation: -0.14 },
    { file: 'animal-bunny.glb', position: [1.62, -0.78, -0.04], scale: 0.92, rotation: -0.22 },
];

const MODEL_ROOT = '/landing-media/models';

export default function PetStage() {
    const containerRef = useRef(null);
    const canvasRef = useRef(null);
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        const container = containerRef.current;
        const canvas = canvasRef.current;

        if (!container || !canvas || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            return undefined;
        }

        let renderer;
        let animationFrame;
        let isDisposed = false;
        const mixers = [];
        const modelRoots = [];
        const pointer = { x: 0, y: 0 };
        const timer = new THREE.Timer();
        timer.connect(document);

        try {
            renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
        } catch {
            return undefined;
        }

        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFShadowMap;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
        camera.position.set(0, 1.1, 7.4);
        camera.lookAt(0, 0.15, 0);

        const stage = new THREE.Group();
        scene.add(stage);

        const ambient = new THREE.HemisphereLight(0xf0fffb, 0x173a45, 2.3);
        scene.add(ambient);

        const keyLight = new THREE.DirectionalLight(0xfff0d6, 5);
        keyLight.position.set(-3, 5, 4);
        keyLight.castShadow = true;
        scene.add(keyLight);

        const rimLight = new THREE.PointLight(0x5eead4, 16, 10);
        rimLight.position.set(3, 1.5, 3);
        scene.add(rimLight);

        const floor = new THREE.Mesh(
            new THREE.CircleGeometry(3.25, 64),
            new THREE.MeshStandardMaterial({ color: 0x0c3240, transparent: true, opacity: 0.32, roughness: 0.9 }),
        );
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -0.84;
        floor.receiveShadow = true;
        stage.add(floor);

        const loader = new GLTFLoader();

        Promise.all(PETS.map((pet) => loader.loadAsync(`${MODEL_ROOT}/${pet.file}`)))
            .then((models) => {
                if (isDisposed) {
                    return;
                }

                models.forEach((gltf, index) => {
                    const pet = PETS[index];
                    const root = gltf.scene;
                    const box = new THREE.Box3().setFromObject(root);
                    const size = box.getSize(new THREE.Vector3());
                    const maxDimension = Math.max(size.x, size.y, size.z) || 1;
                    const normalizedScale = (1.45 / maxDimension) * pet.scale;

                    root.scale.setScalar(normalizedScale);
                    root.position.set(...pet.position);
                    root.rotation.y = pet.rotation;
                    root.traverse((object) => {
                        if (object.isMesh) {
                            object.castShadow = true;
                            object.receiveShadow = true;
                        }
                    });
                    stage.add(root);
                    modelRoots.push({ root, baseY: pet.position[1], phase: index * 1.4 });

                    if (gltf.animations.length) {
                        const mixer = new THREE.AnimationMixer(root);
                        mixer.clipAction(gltf.animations[0]).play();
                        mixers.push(mixer);
                    }
                });

                setIsReady(true);
            })
            .catch(() => {
                setIsReady(false);
            });

        const resize = () => {
            const width = Math.max(container.clientWidth, 1);
            const height = Math.max(container.clientHeight, 1);
            renderer.setSize(width, height, false);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
        };

        const handlePointerMove = (event) => {
            const bounds = container.getBoundingClientRect();
            pointer.x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
            pointer.y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
        };

        const handlePointerLeave = () => {
            pointer.x = 0;
            pointer.y = 0;
        };

        const resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(container);
        container.addEventListener('pointermove', handlePointerMove);
        container.addEventListener('pointerleave', handlePointerLeave);
        resize();

        const render = (timestamp) => {
            timer.update(timestamp);
            const delta = Math.min(timer.getDelta(), 0.05);
            const elapsed = timer.getElapsed();
            mixers.forEach((mixer) => mixer.update(delta));
            stage.rotation.y += (pointer.x * 0.12 - stage.rotation.y) * 0.045;
            stage.rotation.x += (-pointer.y * 0.045 - stage.rotation.x) * 0.045;
            modelRoots.forEach(({ root, baseY, phase }) => {
                root.position.y = baseY + Math.sin(elapsed * 1.35 + phase) * 0.035;
            });
            renderer.render(scene, camera);
            animationFrame = window.requestAnimationFrame(render);
        };

        render();

        return () => {
            isDisposed = true;
            window.cancelAnimationFrame(animationFrame);
            resizeObserver.disconnect();
            container.removeEventListener('pointermove', handlePointerMove);
            container.removeEventListener('pointerleave', handlePointerLeave);
            timer.dispose();
            scene.traverse((object) => {
                object.geometry?.dispose?.();
                if (Array.isArray(object.material)) {
                    object.material.forEach((material) => material.dispose?.());
                } else {
                    object.material?.dispose?.();
                }
            });
            renderer.dispose();
        };
    }, []);

    return (
        <div ref={containerRef} className="landing-pet-stage" aria-label="Interactive 3D dog, cat, parrot, and rabbit">
            <img
                src="/landing-media/pet-ensemble.png"
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
                Move to meet the crew
            </div>
        </div>
    );
}
