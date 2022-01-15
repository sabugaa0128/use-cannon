import { forwardRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { useCompoundBody } from '@react-three/cannon'

import type { BufferGeometry, Material, Object3D } from 'three'
import type { GLTF } from 'three-stdlib/loaders/GLTFLoader'
import type { CylinderProps } from '@react-three/cannon'

useGLTF.preload('/wheel.glb')

// Initially Auto-generated by: https://github.com/pmndrs/gltfjsx

type WheelGLTF = GLTF & {
  materials: Record<'Chrom' | 'Rubber' | 'Steel', Material>
  nodes: Record<'wheel_1' | 'wheel_2' | 'wheel_3', { geometry: BufferGeometry }>
}

type WheelProps = CylinderProps & {
  leftSide?: boolean
  radius: number
}

export const Wheel = forwardRef<Object3D, WheelProps>(({ leftSide, radius = 0.7, ...props }, ref) => {
  const {
    materials: { Chrom, Rubber, Steel },
    nodes,
  } = useGLTF('/wheel.glb') as WheelGLTF

  useCompoundBody(
    () => ({
      collisionFilterGroup: 0,
      mass: 1,
      material: 'wheel',
      shapes: [{ args: [radius, radius, 0.5, 16], rotation: [0, 0, -Math.PI / 2], type: 'Cylinder' }],
      type: 'Kinematic',
      ...props,
    }),
    ref,
  )

  return (
    <group ref={ref}>
      <group rotation={[0, 0, ((leftSide ? 1 : -1) * Math.PI) / 2]}>
        <mesh material={Rubber} geometry={nodes.wheel_1.geometry} />
        <mesh material={Steel} geometry={nodes.wheel_2.geometry} />
        <mesh material={Chrom} geometry={nodes.wheel_3.geometry} />
      </group>
    </group>
  )
})
