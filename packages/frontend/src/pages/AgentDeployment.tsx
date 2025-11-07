import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  ArrowLeft,
  Phone,
  MessageSquare,
  Mic,
  Copy,
  Check,
  ExternalLink,
  Settings,
  Globe,
  Code,
  Trash2,
  Plus
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";

interface Agent {
  id: string;
  name: string;
  description: string;
  status: string;
}

interface Deployment {
  id: string;
  agent_id: string;
  type: 'twilio' | 'chat_widget' | 'voice_widget';
  status: 'active' | 'inactive' | 'error';
  config: any;
  webhook_url?: string;
  embed_code?: string;
  phone_number?: string;
  created_at: string;
  updated_at: string;
}

export default function AgentDeployment() {
  const { agentId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [agent, setAgent] = useState<Agent | null>(null);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deploymentType, setDeploymentType] = useState<'twilio' | 'chat_widget' | 'voice_widget'>('chat_widget');
  const [creating, setCreating] = useState(false);

  // Twilio Config
  const [twilioConfig, setTwilioConfig] = useState({
    phoneNumber: '',
    recordCalls: true,
    transcribeVoicemail: false,
  });

  // Chat Widget Config
  const [chatConfig, setChatConfig] = useState({
    websiteUrl: '',
    widgetPosition: 'bottom-right' as const,
    primaryColor: '#3B82F6',
    welcomeMessage: 'Hi! How can I help you today?',
    placeholder: 'Type your message...',
    showAvatar: true,
    allowFileUpload: false,
  });

  // Voice Widget Config
  const [voiceConfig, setVoiceConfig] = useState({
    websiteUrl: '',
    buttonText: 'Talk to us',
    buttonPosition: 'bottom-right' as const,
    primaryColor: '#3B82F6',
    allowMute: true,
    showDuration: true,
    maxCallDuration: 1800,
  });

  useEffect(() => {
    fetchAgent();
    fetchDeployments();
  }, [agentId]);

  const fetchAgent = async () => {
    try {
      const response = await api.get(`/agents/${agentId}`);
      setAgent(response.data);
    } catch (error) {
      console.error('Error fetching agent:', error);
      toast({
        title: "Error",
        description: "Failed to fetch agent details",
        variant: "destructive",
      });
    }
  };

  const fetchDeployments = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/deployments/agent/${agentId}`);
      setDeployments(response.data);
    } catch (error) {
      console.error('Error fetching deployments:', error);
    } finally {
      setLoading(false);
    }
  };

  const createDeployment = async () => {
    if (!agentId) return;

    setCreating(true);
    try {
      let config;
      switch (deploymentType) {
        case 'twilio':
          config = twilioConfig;
          break;
        case 'chat_widget':
          if (!chatConfig.websiteUrl) {
            toast({
              title: "Error",
              description: "Website URL is required",
              variant: "destructive",
            });
            return;
          }
          config = chatConfig;
          break;
        case 'voice_widget':
          if (!voiceConfig.websiteUrl) {
            toast({
              title: "Error",
              description: "Website URL is required",
              variant: "destructive",
            });
            return;
          }
          config = voiceConfig;
          break;
      }

      const response = await api.post('/deployments', {
        type: deploymentType,
        agentId,
        config,
      });

      toast({
        title: "Success",
        description: "Deployment created successfully",
      });

      setShowCreateDialog(false);
      fetchDeployments();
    } catch (error) {
      console.error('Error creating deployment:', error);
      toast({
        title: "Error",
        description: "Failed to create deployment",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const deleteDeployment = async (deploymentId: string) => {
    try {
      await api.delete(`/deployments/${deploymentId}`);
      toast({
        title: "Success",
        description: "Deployment deleted successfully",
      });
      fetchDeployments();
    } catch (error) {
      console.error('Error deleting deployment:', error);
      toast({
        title: "Error",
        description: "Failed to delete deployment",
        variant: "destructive",
      });
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({
      title: "Copied",
      description: "Copied to clipboard",
    });
  };

  const getDeploymentIcon = (type: string) => {
    switch (type) {
      case 'twilio':
        return <Phone className="h-5 w-5" />;
      case 'chat_widget':
        return <MessageSquare className="h-5 w-5" />;
      case 'voice_widget':
        return <Mic className="h-5 w-5" />;
      default:
        return <Globe className="h-5 w-5" />;
    }
  };

  const getDeploymentColor = (type: string) => {
    switch (type) {
      case 'twilio':
        return 'border-l-blue-500 bg-blue-50';
      case 'chat_widget':
        return 'border-l-green-500 bg-green-50';
      case 'voice_widget':
        return 'border-l-purple-500 bg-purple-50';
      default:
        return 'border-l-gray-500 bg-gray-50';
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/agents")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Agents
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Deploy Agent</h1>
            <p className="text-muted-foreground">
              {agent?.name} - Deploy to multiple channels
            </p>
          </div>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Deployment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Deployment</DialogTitle>
            </DialogHeader>

            <Tabs value={deploymentType} onValueChange={(v) => setDeploymentType(v as any)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="twilio" className="flex items-center space-x-2">
                  <Phone className="h-4 w-4" />
                  <span>Twilio</span>
                </TabsTrigger>
                <TabsTrigger value="chat_widget" className="flex items-center space-x-2">
                  <MessageSquare className="h-4 w-4" />
                  <span>Chat Widget</span>
                </TabsTrigger>
                <TabsTrigger value="voice_widget" className="flex items-center space-x-2">
                  <Mic className="h-4 w-4" />
                  <span>Voice Widget</span>
                </TabsTrigger>
              </TabsList>

              {/* Twilio Configuration */}
              <TabsContent value="twilio" className="space-y-4">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="twilioPhone">Phone Number (Optional)</Label>
                    <Input
                      id="twilioPhone"
                      value={twilioConfig.phoneNumber}
                      onChange={(e) => setTwilioConfig({ ...twilioConfig, phoneNumber: e.target.value })}
                      placeholder="+1234567890"
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      Leave empty to auto-purchase a new number
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Record Calls</Label>
                      <p className="text-sm text-muted-foreground">Save call recordings</p>
                    </div>
                    <Switch
                      checked={twilioConfig.recordCalls}
                      onCheckedChange={(checked) => setTwilioConfig({ ...twilioConfig, recordCalls: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Transcribe Voicemail</Label>
                      <p className="text-sm text-muted-foreground">Convert voicemails to text</p>
                    </div>
                    <Switch
                      checked={twilioConfig.transcribeVoicemail}
                      onCheckedChange={(checked) => setTwilioConfig({ ...twilioConfig, transcribeVoicemail: checked })}
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Chat Widget Configuration */}
              <TabsContent value="chat_widget" className="space-y-4">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="chatWebsite">Website URL *</Label>
                    <Input
                      id="chatWebsite"
                      value={chatConfig.websiteUrl}
                      onChange={(e) => setChatConfig({ ...chatConfig, websiteUrl: e.target.value })}
                      placeholder="https://example.com"
                    />
                  </div>

                  <div>
                    <Label htmlFor="chatWelcome">Welcome Message</Label>
                    <Textarea
                      id="chatWelcome"
                      value={chatConfig.welcomeMessage}
                      onChange={(e) => setChatConfig({ ...chatConfig, welcomeMessage: e.target.value })}
                      rows={2}
                    />
                  </div>

                  <div>
                    <Label htmlFor="chatPlaceholder">Input Placeholder</Label>
                    <Input
                      id="chatPlaceholder"
                      value={chatConfig.placeholder}
                      onChange={(e) => setChatConfig({ ...chatConfig, placeholder: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label htmlFor="chatColor">Primary Color</Label>
                    <div className="flex space-x-2">
                      <Input
                        id="chatColor"
                        type="color"
                        value={chatConfig.primaryColor}
                        onChange={(e) => setChatConfig({ ...chatConfig, primaryColor: e.target.value })}
                        className="w-20"
                      />
                      <Input
                        value={chatConfig.primaryColor}
                        onChange={(e) => setChatConfig({ ...chatConfig, primaryColor: e.target.value })}
                        placeholder="#3B82F6"
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Widget Position</Label>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {['bottom-right', 'bottom-left', 'top-right', 'top-left'].map((pos) => (
                        <Button
                          key={pos}
                          variant={chatConfig.widgetPosition === pos ? 'default' : 'outline'}
                          onClick={() => setChatConfig({ ...chatConfig, widgetPosition: pos as any })}
                          className="justify-start"
                        >
                          {pos.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Show Avatar</Label>
                      <p className="text-sm text-muted-foreground">Display agent avatar</p>
                    </div>
                    <Switch
                      checked={chatConfig.showAvatar}
                      onCheckedChange={(checked) => setChatConfig({ ...chatConfig, showAvatar: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Allow File Upload</Label>
                      <p className="text-sm text-muted-foreground">Let users upload files</p>
                    </div>
                    <Switch
                      checked={chatConfig.allowFileUpload}
                      onCheckedChange={(checked) => setChatConfig({ ...chatConfig, allowFileUpload: checked })}
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Voice Widget Configuration */}
              <TabsContent value="voice_widget" className="space-y-4">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="voiceWebsite">Website URL *</Label>
                    <Input
                      id="voiceWebsite"
                      value={voiceConfig.websiteUrl}
                      onChange={(e) => setVoiceConfig({ ...voiceConfig, websiteUrl: e.target.value })}
                      placeholder="https://example.com"
                    />
                  </div>

                  <div>
                    <Label htmlFor="voiceButton">Button Text</Label>
                    <Input
                      id="voiceButton"
                      value={voiceConfig.buttonText}
                      onChange={(e) => setVoiceConfig({ ...voiceConfig, buttonText: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label htmlFor="voiceColor">Primary Color</Label>
                    <div className="flex space-x-2">
                      <Input
                        id="voiceColor"
                        type="color"
                        value={voiceConfig.primaryColor}
                        onChange={(e) => setVoiceConfig({ ...voiceConfig, primaryColor: e.target.value })}
                        className="w-20"
                      />
                      <Input
                        value={voiceConfig.primaryColor}
                        onChange={(e) => setVoiceConfig({ ...voiceConfig, primaryColor: e.target.value })}
                        placeholder="#3B82F6"
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Button Position</Label>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {['bottom-right', 'bottom-left', 'top-right', 'top-left'].map((pos) => (
                        <Button
                          key={pos}
                          variant={voiceConfig.buttonPosition === pos ? 'default' : 'outline'}
                          onClick={() => setVoiceConfig({ ...voiceConfig, buttonPosition: pos as any })}
                          className="justify-start"
                        >
                          {pos.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Allow Mute</Label>
                      <p className="text-sm text-muted-foreground">Enable mute button</p>
                    </div>
                    <Switch
                      checked={voiceConfig.allowMute}
                      onCheckedChange={(checked) => setVoiceConfig({ ...voiceConfig, allowMute: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Show Duration</Label>
                      <p className="text-sm text-muted-foreground">Display call duration</p>
                    </div>
                    <Switch
                      checked={voiceConfig.showDuration}
                      onCheckedChange={(checked) => setVoiceConfig({ ...voiceConfig, showDuration: checked })}
                    />
                  </div>

                  <div>
                    <Label htmlFor="maxDuration">Max Call Duration (seconds)</Label>
                    <Input
                      id="maxDuration"
                      type="number"
                      value={voiceConfig.maxCallDuration}
                      onChange={(e) => setVoiceConfig({ ...voiceConfig, maxCallDuration: parseInt(e.target.value) })}
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button onClick={createDeployment} disabled={creating}>
                {creating ? 'Creating...' : 'Create Deployment'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Deployments List */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : deployments.length === 0 ? (
          <Card>
            <CardContent className="py-16">
              <div className="text-center">
                <div className="mx-auto w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-6">
                  <Globe className="h-12 w-12 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold mb-2">No Deployments Yet</h3>
                <p className="text-muted-foreground mb-6">
                  Deploy your agent to Twilio, chat widget, or voice widget
                </p>
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Deployment
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          deployments.map((deployment) => (
            <Card key={deployment.id} className={`border-l-4 ${getDeploymentColor(deployment.type)}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${deployment.type === 'twilio' ? 'bg-blue-100' : deployment.type === 'chat_widget' ? 'bg-green-100' : 'bg-purple-100'}`}>
                      {getDeploymentIcon(deployment.type)}
                    </div>
                    <div>
                      <CardTitle className="flex items-center space-x-2">
                        <span>{deployment.type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}</span>
                        <Badge variant={deployment.status === 'active' ? 'default' : 'secondary'}>
                          {deployment.status}
                        </Badge>
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Created {new Date(deployment.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteDeployment(deployment.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Twilio Deployment */}
                {deployment.type === 'twilio' && deployment.phone_number && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-background rounded-lg border">
                      <div>
                        <Label className="text-sm font-medium">Phone Number</Label>
                        <p className="text-lg font-mono">{deployment.phone_number}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(deployment.phone_number!, `phone-${deployment.id}`)}
                      >
                        {copiedId === `phone-${deployment.id}` ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    {deployment.webhook_url && (
                      <div className="flex items-center justify-between p-3 bg-background rounded-lg border">
                        <div className="flex-1 min-w-0">
                          <Label className="text-sm font-medium">Webhook URL</Label>
                          <p className="text-sm font-mono truncate">{deployment.webhook_url}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(deployment.webhook_url!, `webhook-${deployment.id}`)}
                        >
                          {copiedId === `webhook-${deployment.id}` ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Chat/Voice Widget Deployment */}
                {(deployment.type === 'chat_widget' || deployment.type === 'voice_widget') && deployment.embed_code && (
                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm font-medium mb-2 block">Embed Code</Label>
                      <div className="relative">
                        <pre className="p-4 bg-muted rounded-lg text-sm overflow-x-auto">
                          <code>{deployment.embed_code}</code>
                        </pre>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute top-2 right-2"
                          onClick={() => copyToClipboard(deployment.embed_code!, `embed-${deployment.id}`)}
                        >
                          {copiedId === `embed-${deployment.id}` ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Copy and paste this code into your website's HTML, just before the closing &lt;/body&gt; tag
                    </p>
                  </div>
                )}

                {/* Configuration Details */}
                <div className="pt-3 border-t">
                  <Label className="text-sm font-medium mb-2 block">Configuration</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(deployment.config).map(([key, value]) => (
                      <div key={key} className="text-sm">
                        <span className="text-muted-foreground">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                        <span className="ml-2 font-medium">
                          {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
