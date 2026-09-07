import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './contexto/AuthContext'
import { ToastProvider } from './contexto/ToastContext'
import { TemaProvider } from './contexto/TemaContext'
import { SeguidosProvider } from './contexto/SeguidosContext'
import { FavoritosProvider } from './contexto/FavoritosContext'
import Proyecto from './paginas/Proyecto'
import Inicio from './paginas/Inicio'
import Login from './paginas/Login'
import Registro from './paginas/Registro'
import Ayuda from './paginas/Ayuda'

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <TemaProvider>
          <SeguidosProvider>
            <FavoritosProvider>
              <BrowserRouter>
                <Routes>
                  <Route path="/" element={<Proyecto />} />
                  <Route path="/app" element={<Inicio />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/registro" element={<Registro />} />
                  <Route path="/ayuda" element={<Ayuda />} />
                  <Route path="*" element={<Proyecto />} />
                </Routes>
              </BrowserRouter>
            </FavoritosProvider>
          </SeguidosProvider>
        </TemaProvider>
      </ToastProvider>
    </AuthProvider>
  )
}