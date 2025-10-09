import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'

function Box() {
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="hotpink" />
    </mesh>
  )
}

function App() {
  return (
    <div className="h-screen w-screen bg-gray-100 flex items-center justify-center">
      <div className="h-4/5 w-4/5 bg-white rounded-lg shadow-lg">
        <Canvas camera={{ position: [0, 0, 5], fov: 75 }}>
          <ambientLight intensity={0.5} />
          <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} />
          <pointLight position={[-10, -10, -10]} />
          <Box />
          <OrbitControls />
        </Canvas>
      </div>
    </div>
  )
}

export default App