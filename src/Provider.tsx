import type { Shape } from 'cannon-es'
import type { Buffers, Refs, Events, Promises, ProviderContext } from './index'
import type { AtomicProps } from './hooks'
import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useThree } from 'react-three-fiber'
import { context } from './index'
// @ts-ignore
import CannonWorker from '../src/worker'

export type ProviderProps = {
  children: React.ReactNode
  gravity?: number[]
  tolerance?: number
  step?: number
  iterations?: number
  allowSleep?: boolean
  broadphase?: 'Naive' | 'SAP'
  axisIndex?: number
  defaultContactMaterial?: {
    friction?: number
    restitution?: number
    contactEquationStiffness?: number
    contactEquationRelaxation?: number
    frictionEquationStiffness?: number
    frictionEquationRelaxation?: number
  }
  size?: number
}

type WorkerFrameMessage = { data: Buffers & { op: 'frame'; active: boolean } }
type WorkerSyncMessage = { data: { op: 'sync'; bodies: string[] } }
type WorkerResolveMessage = {
  data: { op: 'resolve'; promise: string; value: AtomicProps[keyof AtomicProps] }
}
export type WorkerCollideEvent = {
  data: {
    op: 'event'
    type: 'collide'
    body: string
    target: string
    contact: {
      ni: number[]
      ri: number[]
      rj: number[]
      impactVelocity: number
    }
    collisionFilters: {
      bodyFilterGroup: number
      bodyFilterMask: number
      targetFilterGroup: number
      targetFilterMask: number
    }
  }
}
export type WorkerRayhitEvent = {
  data: {
    op: 'event'
    type: 'rayhit'
    ray: {
      from: number[]
      to: number[]
      direction: number[]
      collisionFilterGroup: number
      collisionFilterMask: number
      uuid: string
    }
    hasHit: boolean
    body: string | null
    shape: (Omit<Shape, 'body'> & { body: string }) | null
    rayFromWorld: number[]
    rayToWorld: number[]
    hitNormalWorld: number[]
    hitPointWorld: number[]
    hitFaceIndex: number
    distance: number
    shouldStop: boolean
  }
}
type WorkerEventMessage = WorkerCollideEvent | WorkerRayhitEvent
type IncomingWorkerMessage =
  | WorkerFrameMessage
  | WorkerSyncMessage
  | WorkerResolveMessage
  | WorkerEventMessage

export default function Provider({
  children,
  step = 1 / 60,
  gravity = [0, -10, 0],
  tolerance = 0.001,
  iterations = 5,
  allowSleep = true,
  broadphase = 'Naive',
  axisIndex = 0,
  defaultContactMaterial = {
    contactEquationStiffness: 1e6,
  },
  size = 1000,
}: ProviderProps): JSX.Element {
  const { invalidate } = useThree()
  const [worker] = useState<Worker>(() => new CannonWorker() as Worker)
  const [refs] = useState<Refs>({})
  const [events] = useState<Events>({})
  const [promises] = useState<Promises>({})
  const [buffers] = useState<Buffers>(() => ({
    positions: new Float32Array(size * 3),
    quaternions: new Float32Array(size * 4),
  }))
  const bodies = useRef<{ [uuid: string]: number }>({})

  useEffect(() => {
    worker.postMessage({
      op: 'init',
      props: {
        gravity,
        tolerance,
        step,
        iterations,
        broadphase,
        allowSleep,
        axisIndex,
        defaultContactMaterial,
      },
    })

    function loop() {
      worker.postMessage({ op: 'step', ...buffers }, [buffers.positions.buffer, buffers.quaternions.buffer])
    }

    worker.onmessage = (e: IncomingWorkerMessage) => {
      switch (e.data.op) {
        case 'frame':
          buffers.positions = e.data.positions
          buffers.quaternions = e.data.quaternions
          requestAnimationFrame(loop)
          if (e.data.active) invalidate()
          break
        case 'sync':
          bodies.current = e.data.bodies.reduce(
            (acc, id) => ({ ...acc, [id]: (e.data as any).bodies.indexOf(id) }),
            {}
          )
          break
        case 'resolve':
          const { promise, value } = e.data
          if (promises[promise]) {
            promises[promise](value)
            delete promises[promise]
          }
          break
        case 'event':
          switch (e.data.type) {
            case 'collide':
              events[e.data.body]({
                ...e.data,
                body: refs[e.data.body],
                target: refs[e.data.target],
              })
              break
            case 'rayhit':
              events[e.data.ray.uuid]({
                ...e.data,
                body: e.data.body ? refs[e.data.body] : null,
              })
              break
          }
          break
      }
    }
    loop()
    return () => worker.terminate()
  }, [])

  const api = useMemo(() => ({ worker, bodies, buffers, refs, events, promises }), [
    worker,
    bodies,
    buffers,
    refs,
    events,
    promises,
  ])
  return <context.Provider value={api as ProviderContext}>{children}</context.Provider>
}
