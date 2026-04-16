import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

const FloatingOrb = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || window.innerWidth < 768) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, 300 / 300, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    
    renderer.setSize(300, 300);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    containerRef.current.appendChild(renderer.domElement);

    const geometry = new THREE.SphereGeometry(1.5, 32, 32);
    const material = new THREE.MeshStandardMaterial({
      color: '#14b8a6',
      transparent: true,
      opacity: 0.12,
      roughness: 0.3,
      metalness: 0.2
    });

    const orb = new THREE.Mesh(geometry, material);
    scene.add(orb);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xffffff, 1);
    pointLight.position.set(5, 5, 5);
    scene.add(pointLight);

    camera.position.z = 4;

    const animate = (time: number) => {
      requestAnimationFrame(animate);
      
      const elapsed = time * 0.001;
      orb.rotation.y += 0.003;
      orb.rotation.x += 0.002;
      orb.position.y = Math.sin(elapsed * 0.5) * 0.3;

      renderer.render(scene, camera);
    };

    animate(0);

    return () => {
      if (containerRef.current) {
        containerRef.current.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  return <div ref={containerRef} className="absolute right-0 top-1/2 -translate-y-1/2 w-72 h-72 z-0 pointer-events-none opacity-50" />;
};

export default FloatingOrb;
