import { Suspense } from "react"
import { Canvas } from "@react-three/fiber"
import { Environment, OrbitControls, Stars } from "@react-three/drei"
import { useNavigate } from "react-router-dom"

import type { InvoiceListItem } from "@/api/types"
import { InvoiceCard3D } from "./InvoiceCard3D"
import { PipelinePath3D } from "./PipelinePath3D"

interface Props {
  invoices: InvoiceListItem[]
}

export function FlowScene({ invoices }: Props) {
  const navigate = useNavigate()

  // Position invoices in a curved arc above the pipeline
  const cards = invoices.slice(0, 8).map((inv, i, arr) => {
    const t = arr.length === 1 ? 0.5 : i / (arr.length - 1)
    const angle = (t - 0.5) * Math.PI * 0.8
    const radius = 5
    const x = Math.sin(angle) * radius
    const y = 1.5 + Math.cos(angle) * 1.5
    const z = -Math.cos(angle) * 1.5
    return { invoice: inv, position: [x, y, z] as [number, number, number] }
  })

  return (
    <Canvas
      camera={{ position: [0, 2, 9], fov: 50 }}
      gl={{ antialias: true, alpha: true }}
      dpr={[1, 2]}
      className="bg-gradient-to-b from-slate-950 via-slate-900 to-blue-950"
    >
      <Suspense fallback={null}>
        {/* Lighting */}
        <ambientLight intensity={0.3} />
        <directionalLight position={[5, 10, 5]} intensity={0.6} />
        <pointLight position={[-5, 3, 5]} intensity={0.4} color="#3b82f6" />
        <pointLight position={[5, -3, 5]} intensity={0.4} color="#8b5cf6" />

        {/* Background stars */}
        <Stars
          radius={50}
          depth={50}
          count={3000}
          factor={3}
          saturation={0}
          fade
          speed={0.5}
        />

        {/* Environment for reflections */}
        <Environment preset="night" />

        {/* Pipeline path */}
        <PipelinePath3D />

        {/* Floating invoice cards */}
        {cards.map(({ invoice, position }, i) => (
          <InvoiceCard3D
            key={invoice.id}
            invoice={invoice}
            position={position}
            delay={i * 0.3}
            onClick={() => navigate(`/invoices/${invoice.id}`)}
          />
        ))}

        {/* Camera controls */}
        <OrbitControls
          enablePan={false}
          enableZoom={true}
          minDistance={5}
          maxDistance={15}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 1.8}
          autoRotate
          autoRotateSpeed={0.3}
        />
      </Suspense>
    </Canvas>
  )
}
