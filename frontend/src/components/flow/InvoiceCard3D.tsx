import { useRef, useMemo } from "react"
import { useFrame } from "@react-three/fiber"
import { Html, RoundedBox } from "@react-three/drei"
import * as THREE from "three"

import type { InvoiceListItem } from "@/api/types"

interface Props {
  invoice: InvoiceListItem
  position: [number, number, number]
  onClick?: () => void
  delay?: number
}

const STATUS_COLOR: Record<string, string> = {
  approved: "#10b981",
  pending_review: "#f59e0b",
  rejected: "#ef4444",
  pending: "#64748b",
  cancelled: "#94a3b8",
}

export function InvoiceCard3D({ invoice, position, onClick, delay = 0 }: Props) {
  const ref = useRef<THREE.Group>(null!)
  const hoveredRef = useRef(false)

  const color = useMemo(
    () => STATUS_COLOR[invoice.business_status] ?? "#64748b",
    [invoice.business_status]
  )

  const initialY = position[1]
  const phase = useMemo(() => Math.random() * Math.PI * 2, [])

  useFrame((state) => {
    if (!ref.current) return
    const t = state.clock.elapsedTime + delay + phase
    // Floating bob
    ref.current.position.y = initialY + Math.sin(t * 1.2) * 0.15
    // Subtle rotation
    ref.current.rotation.y = Math.sin(t * 0.4) * 0.1
    ref.current.rotation.x = Math.cos(t * 0.3) * 0.05

    // Hover scale
    const target = hoveredRef.current ? 1.1 : 1
    ref.current.scale.lerp(new THREE.Vector3(target, target, target), 0.1)
  })

  return (
    <group
      ref={ref}
      position={position}
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        hoveredRef.current = true
        document.body.style.cursor = "pointer"
      }}
      onPointerOut={() => {
        hoveredRef.current = false
        document.body.style.cursor = "auto"
      }}
    >
      {/* Glow */}
      <pointLight color={color} intensity={0.5} distance={3} />

      {/* Card body */}
      <RoundedBox args={[1.6, 2.2, 0.08]} radius={0.08} smoothness={4}>
        <meshPhysicalMaterial
          color={color}
          metalness={0.2}
          roughness={0.3}
          transmission={0.4}
          thickness={0.4}
          ior={1.4}
          attenuationColor={color}
          attenuationDistance={1}
          envMapIntensity={1}
          transparent
          opacity={0.85}
        />
      </RoundedBox>

      {/* Subtle gradient overlay using a thin plane */}
      <mesh position={[0, 0, 0.045]}>
        <planeGeometry args={[1.5, 2.1]} />
        <meshBasicMaterial color={color} transparent opacity={0.15} />
      </mesh>

      {/* Label as HTML overlay */}
      <Html
        position={[0, 0, 0.06]}
        center
        distanceFactor={6}
        style={{ pointerEvents: "none" }}
      >
        <div className="w-32 text-center select-none">
          <div className="text-[8px] uppercase tracking-wider text-white/70 font-medium">
            Invoice
          </div>
          <div className="text-xs font-semibold text-white truncate">
            {invoice.invoice_number ?? invoice.id.slice(0, 8)}
          </div>
          <div className="mt-1 text-[10px] text-white/80 capitalize">
            {invoice.business_status.replace("_", " ")}
          </div>
        </div>
      </Html>
    </group>
  )
}
