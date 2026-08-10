import { useState } from 'react'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'

/** Troca a senha do usuário logado — só precisa de uma sessão ativa (não pede a senha antiga, o Supabase já confirma pela sessão). */
export function MinhaContaTab() {
  const { toast } = useToast()
  const { user } = useAuth()
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [salvando, setSalvando] = useState(false)

  async function handleSalvar() {
    if (novaSenha.length < 6) {
      toast({ title: 'Senha muito curta', description: 'Use pelo menos 6 caracteres.', variant: 'destructive' })
      return
    }
    if (novaSenha !== confirmarSenha) {
      toast({ title: 'As senhas não coincidem', variant: 'destructive' })
      return
    }
    setSalvando(true)
    const { error } = await supabase.auth.updateUser({ password: novaSenha })
    setSalvando(false)
    if (error) {
      toast({ title: 'Erro ao trocar senha', description: error.message, variant: 'destructive' })
      return
    }
    toast({ title: 'Senha alterada' })
    setNovaSenha('')
    setConfirmarSenha('')
  }

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>Minha Conta</CardTitle>
        <p className="text-sm text-muted-foreground">
          Trocar a senha de {user?.email}. Não precisa da senha atual — já está logado.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="nova-senha">Nova senha</Label>
          <div className="relative">
            <Input
              id="nova-senha"
              type={mostrarSenha ? 'text' : 'password'}
              value={novaSenha}
              onChange={e => setNovaSenha(e.target.value)}
              placeholder="••••••••"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setMostrarSenha(v => !v)}
              tabIndex={-1}
              aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
            >
              {mostrarSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirmar-senha">Confirmar nova senha</Label>
          <Input
            id="confirmar-senha"
            type={mostrarSenha ? 'text' : 'password'}
            value={confirmarSenha}
            onChange={e => setConfirmarSenha(e.target.value)}
            placeholder="••••••••"
          />
        </div>
        <Button onClick={handleSalvar} disabled={salvando || !novaSenha || !confirmarSenha} className="gap-2">
          {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
          Salvar nova senha
        </Button>
      </CardContent>
    </Card>
  )
}
