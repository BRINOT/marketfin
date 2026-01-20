import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ExternalLink } from "lucide-react"

interface MarketplaceCardProps {
  name: string
  description: string
  icon?: React.ReactNode
  status: "connected" | "disconnected" | "pending"
  onConnect?: () => void
  onDisconnect?: () => void
}

export function MarketplaceCard({
  name,
  description,
  icon,
  status,
  onConnect,
  onDisconnect,
}: MarketplaceCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center space-x-4">
          {icon && <div className="h-10 w-10">{icon}</div>}
          <div>
            <CardTitle className="text-lg">{name}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
        <Badge
          variant={status === "connected" ? "default" : status === "pending" ? "secondary" : "outline"}
        >
          {status === "connected" ? "Conectado" : status === "pending" ? "Pendente" : "Desconectado"}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="flex justify-end space-x-2">
          {status === "connected" ? (
            <Button variant="outline" size="sm" onClick={onDisconnect}>
              Desconectar
            </Button>
          ) : (
            <Button size="sm" onClick={onConnect}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Conectar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
