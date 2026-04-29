import { useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { Sphere, Text, Tube } from "@react-three/drei"
import * as THREE from "three"

const STATIONS = [
  { label: "Parser", x: -6 },
  { label: "Matcher", x: -2 },
  { label: "Anomaly", x: 2 },
  { label: "Resolution", x: 6 },
]

export function PipelinePath3D() {
  const curve = useMemo(() => {
    const points = STATIONS.map(
      (s, i) =>
        new THREE.Vector3(
          s.x,
          Math.sin(i * 0.5) * 0.3,
          0
        )
    )
    return new THREE.CatmullRomCurve3(points)
  }, [])

  return (
    <group position={[0, -1.5, -1]}>
      {/* Path tube */}
      <Tube args={[curve, 64, 0.05, 8, false]}>
        <meshStandardMaterial
          color="#3b82f6"
          emissive="#3b82f6"
          emissiveIntensity={0.4}
          transparent
          opacity={0.5}
        />
      </Tube>

      {/* Stations */}
      {STATIONS.map((s, i) => (
        <Station key={s.label} label={s.label} position={[s.x, 0, 0]} delay={i * 0.5} />
      ))}

      {/* Flowing energy particles */}
      <Particle curve={curve} speed={0.4} delay={0} />
      <Particle curve={curve} speed={0.4} delay={1.5} />
      <Particle curve={curve} speed={0.4} delay={3} />
    </group>
  )
}

function Station({
  label,
  position,
  delay,
}: {
  label: string
  position: [number, number, number]
  delay: number
}) {
  const ref = useRef<THREE.Mesh>(null!)

  useFrame((state) => {
    if (!ref.current) return
    const t = state.clock.elapsedTime + delay
    const scale = 1 + Math.sin(t * 1.5) * 0.08
    ref.current.scale.setScalar(scale)
  })

  return (
    <group position={position}>
      <Sphere ref={ref} args={[0.4, 32, 32]}>
        <meshStandardMaterial
          color="#3b82f6"
          emissive="#3b82f6"
          emissiveIntensity={0.6}
          metalness={0.5}
          roughness={0.2}
        />
      </Sphere>
      <pointLight color="#3b82f6" intensity={1} distance={3} />
      <Text
        position={[0, -0.9, 0]}
        fontSize={0.22}
        color="white"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.01}
        outlineColor="#000000"
      >
        {label}
      </Text>
    </group>
  )
}

function Particle({
  curve,
  speed,
  delay,
}: {
  curve: THREE.CatmullRomCurve3
  speed: number
  delay: number
}) {
  const ref = useRef<THREE.Mesh>(null!)

  useFrame((state) => {
    if (!ref.current) return
    const t = ((state.clock.elapsedTime * speed + delay) % 1)
    const pt = curve.getPoint(t)
    ref.current.position.copy(pt)
  })

  return (
    <Sphere ref={ref} args={[0.06, 16, 16]}>
      <meshStandardMaterial
        color="#ffffff"
        emissive="#ffffff"
        emissiveIntensity={2}
      />
    </Sphere>
  )
}
