import { WidgetConfig } from '../index';
import { WidgetSDK, DeploymentConfig } from '../sdk/WidgetSDK';

export interface DeploymentOptions {
  environment: 'development' | 'staging' | 'production';
  cdnUrl?: string;
  analyticsEnabled?: boolean;
  customDomain?: string;
  sslEnabled?: boolean;
}

export interface IntegrationGuide {
  html: string;
  javascript: string;
  react: string;
  vue: string;
  angular: string;
  wordpress: string;
  shopify: string;
}

export class DeploymentHelper {
  private sdk: WidgetSDK;

  constructor(sdk?: WidgetSDK) {
    this.sdk = sdk || WidgetSDK.getInstance();
  }

  generateDeployment(
    agentId: string,
    widgetConfig: WidgetConfig,
    options: DeploymentOptions = { environment: 'production' }
  ): DeploymentConfig & { integrationGuide: IntegrationGuide } {
    const baseConfig = this.sdk.generateDeploymentConfig(agentId, widgetConfig);
    
    // Update URLs based on environment
    const scriptUrl = this.getScriptUrl(options);
    const embedCode = this.generateEnvironmentSpecificEmbedCode(agentId, widgetConfig, scriptUrl, options);
    
    const deploymentConfig: DeploymentConfig = {
      ...baseConfig,
      scriptUrl,
      embedCode,
      analytics: {
        enabled: options.analyticsEnabled !== false,
        trackingId: `${options.environment}_${agentId}`,
      },
    };

    const integrationGuide = this.generateIntegrationGuide(deploymentConfig);

    return {
      ...deploymentConfig,
      integrationGuide,
    };
  }

  private getScriptUrl(options: DeploymentOptions): string {
    if (options.cdnUrl) {
      return `${options.cdnUrl}/widget.js`;
    }

    switch (options.environment) {
      case 'development':
        return 'http://localhost:5173/widget.js';
      case 'staging':
        return 'https://staging-cdn.aiagent.com/widget.js';
      case 'production':
      default:
        return 'https://cdn.aiagent.com/widget.js';
    }
  }

  private generateEnvironmentSpecificEmbedCode(
    agentId: string,
    config: WidgetConfig,
    scriptUrl: string,
    options: DeploymentOptions
  ): string {
    const attributes = this.buildAttributes(agentId, config, options);
    
    return `<!-- AI Widget - ${options.environment.toUpperCase()} -->
<script 
  src="${scriptUrl}"
  ${attributes.join('\n  ')}
  data-environment="${options.environment}"
  ${options.analyticsEnabled !== false ? 'data-analytics="true"' : ''}
></script>
<!-- End AI Widget -->`;
  }

  private buildAttributes(agentId: string, config: WidgetConfig, _options: DeploymentOptions): string[] {
    const attributes = [`data-agent-id="${agentId}"`];

    // Add configuration attributes
    if (config.apiUrl) attributes.push(`data-api-url="${config.apiUrl}"`);
    if (config.theme) attributes.push(`data-theme="${config.theme}"`);
    if (config.position) attributes.push(`data-position="${config.position}"`);
    if (config.size) attributes.push(`data-size="${config.size}"`);
    if (config.autoOpen) attributes.push(`data-auto-open="${config.autoOpen}"`);
    if (config.voiceEnabled !== undefined) attributes.push(`data-voice-enabled="${config.voiceEnabled}"`);
    if (config.greeting) attributes.push(`data-greeting="${this.escapeAttribute(config.greeting)}"`);
    if (config.placeholder) attributes.push(`data-placeholder="${this.escapeAttribute(config.placeholder)}"`);
    if (config.zIndex) attributes.push(`data-z-index="${config.zIndex}"`);

    // Add branding attributes
    if (config.branding?.companyName) {
      attributes.push(`data-company-name="${this.escapeAttribute(config.branding.companyName)}"`);
    }
    if (config.branding?.logo) attributes.push(`data-logo="${config.branding.logo}"`);
    if (config.branding?.showPoweredBy !== undefined) {
      attributes.push(`data-show-powered-by="${config.branding.showPoweredBy}"`);
    }

    // Add theme attributes
    if (config.customTheme?.primaryColor) {
      attributes.push(`data-primary-color="${config.customTheme.primaryColor}"`);
    }

    return attributes;
  }

  private escapeAttribute(value: string): string {
    return value.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  private generateIntegrationGuide(config: DeploymentConfig): IntegrationGuide {
    return {
      html: this.generateHTMLGuide(config),
      javascript: this.generateJavaScriptGuide(config),
      react: this.generateReactGuide(config),
      vue: this.generateVueGuide(config),
      angular: this.generateAngularGuide(config),
      wordpress: this.generateWordPressGuide(config),
      shopify: this.generateShopifyGuide(config),
    };
  }

  private generateHTMLGuide(config: DeploymentConfig): string {
    return `<!-- HTML Integration -->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your Website</title>
</head>
<body>
    <!-- Your website content -->
    
    <!-- AI Widget - Place before closing </body> tag -->
    ${config.embedCode}
</body>
</html>

<!-- Optional: Control widget programmatically -->
<script>
// Wait for widget to load
document.addEventListener('DOMContentLoaded', function() {
    // Access widget after it's initialized
    setTimeout(function() {
        if (window.AIWidget) {
            // Widget is available for programmatic control
            console.log('AI Widget loaded successfully');
        }
    }, 1000);
});
</script>`;
  }

  private generateJavaScriptGuide(config: DeploymentConfig): string {
    return `// JavaScript Integration
// Method 1: Using the embed code (recommended)
document.body.insertAdjacentHTML('beforeend', \`${config.embedCode}\`);

// Method 2: Programmatic initialization
import { AIWidget } from '${config.scriptUrl}';

const widget = new AIWidget({
    agentId: '${config.agentId}',
    theme: '${config.widgetConfig.theme || 'light'}',
    position: '${config.widgetConfig.position || 'bottom-right'}',
    voiceEnabled: ${config.widgetConfig.voiceEnabled || false},
    // ... other configuration options
});

await widget.init();

// Control the widget
widget.show();
widget.hide();
widget.toggle();
widget.sendMessageProgrammatically('Hello!');
widget.clearConversation();

// Listen for events (if needed)
// Note: Event system would need to be implemented
`;
  }

  private generateReactGuide(config: DeploymentConfig): string {
    return `// React Integration
import React, { useEffect, useRef } from 'react';

const AIWidgetComponent = () => {
    const widgetRef = useRef(null);

    useEffect(() => {
        // Method 1: Using script tag
        const script = document.createElement('script');
        script.src = '${config.scriptUrl}';
        script.setAttribute('data-agent-id', '${config.agentId}');
        script.setAttribute('data-theme', '${config.widgetConfig.theme || 'light'}');
        script.setAttribute('data-position', '${config.widgetConfig.position || 'bottom-right'}');
        script.setAttribute('data-voice-enabled', '${config.widgetConfig.voiceEnabled || false}');
        
        document.body.appendChild(script);

        return () => {
            // Cleanup
            document.body.removeChild(script);
        };
    }, []);

    return null; // Widget renders itself
};

// Alternative: Hook-based approach
import { useState, useEffect } from 'react';

const useAIWidget = (config) => {
    const [widget, setWidget] = useState(null);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        const loadWidget = async () => {
            const { AIWidget } = await import('${config.scriptUrl}');
            const widgetInstance = new AIWidget(config);
            await widgetInstance.init();
            setWidget(widgetInstance);
            setIsLoaded(true);
        };

        loadWidget();

        return () => {
            if (widget) {
                widget.destroy();
            }
        };
    }, []);

    return { widget, isLoaded };
};

// Usage in component
const MyComponent = () => {
    const { widget, isLoaded } = useAIWidget({
        agentId: '${config.agentId}',
        theme: '${config.widgetConfig.theme || 'light'}',
        // ... other config
    });

    const handleShowWidget = () => {
        if (widget) widget.show();
    };

    return (
        <div>
            <button onClick={handleShowWidget} disabled={!isLoaded}>
                Show AI Assistant
            </button>
        </div>
    );
};

export default AIWidgetComponent;`;
  }

  private generateVueGuide(config: DeploymentConfig): string {
    return `<!-- Vue.js Integration -->
<template>
  <div>
    <!-- Your Vue app content -->
    <button @click="showWidget" :disabled="!widgetLoaded">
      Show AI Assistant
    </button>
  </div>
</template>

<script>
export default {
  name: 'AIWidgetIntegration',
  data() {
    return {
      widget: null,
      widgetLoaded: false
    };
  },
  async mounted() {
    // Method 1: Script tag approach
    this.loadWidgetScript();
    
    // Method 2: Dynamic import (if using module bundler)
    // await this.loadWidgetModule();
  },
  methods: {
    loadWidgetScript() {
      const script = document.createElement('script');
      script.src = '${config.scriptUrl}';
      script.setAttribute('data-agent-id', '${config.agentId}');
      script.setAttribute('data-theme', '${config.widgetConfig.theme || 'light'}');
      script.setAttribute('data-position', '${config.widgetConfig.position || 'bottom-right'}');
      script.onload = () => {
        this.widgetLoaded = true;
      };
      document.head.appendChild(script);
    },
    
    async loadWidgetModule() {
      try {
        const { AIWidget } = await import('${config.scriptUrl}');
        this.widget = new AIWidget({
          agentId: '${config.agentId}',
          theme: '${config.widgetConfig.theme || 'light'}',
          position: '${config.widgetConfig.position || 'bottom-right'}',
          voiceEnabled: ${config.widgetConfig.voiceEnabled || false}
        });
        await this.widget.init();
        this.widgetLoaded = true;
      } catch (error) {
        console.error('Failed to load AI Widget:', error);
      }
    },
    
    showWidget() {
      if (this.widget) {
        this.widget.show();
      }
    }
  },
  beforeDestroy() {
    if (this.widget) {
      this.widget.destroy();
    }
  }
};
</script>`;
  }

  private generateAngularGuide(config: DeploymentConfig): string {
    return `// Angular Integration
// ai-widget.service.ts
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AIWidgetService {
  private widget: any = null;
  private isLoaded = false;

  async loadWidget(config: any): Promise<void> {
    if (this.isLoaded) return;

    try {
      // Dynamic import
      const { AIWidget } = await import('${config.scriptUrl}');
      this.widget = new AIWidget(config);
      await this.widget.init();
      this.isLoaded = true;
    } catch (error) {
      console.error('Failed to load AI Widget:', error);
    }
  }

  showWidget(): void {
    if (this.widget) {
      this.widget.show();
    }
  }

  hideWidget(): void {
    if (this.widget) {
      this.widget.hide();
    }
  }

  destroy(): void {
    if (this.widget) {
      this.widget.destroy();
      this.widget = null;
      this.isLoaded = false;
    }
  }
}

// app.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { AIWidgetService } from './ai-widget.service';

@Component({
  selector: 'app-root',
  template: \`
    <div>
      <button (click)="showWidget()" [disabled]="!widgetLoaded">
        Show AI Assistant
      </button>
    </div>
  \`
})
export class AppComponent implements OnInit, OnDestroy {
  widgetLoaded = false;

  constructor(private aiWidgetService: AIWidgetService) {}

  async ngOnInit(): Promise<void> {
    await this.aiWidgetService.loadWidget({
      agentId: '${config.agentId}',
      theme: '${config.widgetConfig.theme || 'light'}',
      position: '${config.widgetConfig.position || 'bottom-right'}',
      voiceEnabled: ${config.widgetConfig.voiceEnabled || false}
    });
    this.widgetLoaded = true;
  }

  showWidget(): void {
    this.aiWidgetService.showWidget();
  }

  ngOnDestroy(): void {
    this.aiWidgetService.destroy();
  }
}`;
  }

  private generateWordPressGuide(config: DeploymentConfig): string {
    return `<!-- WordPress Integration -->

<!-- Method 1: Add to theme files -->
<!-- Add to your theme's footer.php before closing </body> tag -->
${config.embedCode}

<!-- Method 2: Using WordPress hooks (functions.php) -->
<?php
function add_ai_widget() {
    ?>
    ${config.embedCode}
    <?php
}
add_action('wp_footer', 'add_ai_widget');
?>

<!-- Method 3: Using a plugin or custom post -->
<!-- Create a new plugin file: wp-content/plugins/ai-widget/ai-widget.php -->
<?php
/**
 * Plugin Name: AI Widget
 * Description: Adds AI chat widget to your WordPress site
 * Version: 1.0
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

class AIWidgetPlugin {
    public function __construct() {
        add_action('wp_footer', array($this, 'add_widget_script'));
        add_action('admin_menu', array($this, 'add_admin_menu'));
    }

    public function add_widget_script() {
        ?>
        ${config.embedCode}
        <?php
    }

    public function add_admin_menu() {
        add_options_page(
            'AI Widget Settings',
            'AI Widget',
            'manage_options',
            'ai-widget-settings',
            array($this, 'settings_page')
        );
    }

    public function settings_page() {
        ?>
        <div class="wrap">
            <h1>AI Widget Settings</h1>
            <p>The AI Widget is active on your site.</p>
            <p>Agent ID: ${config.agentId}</p>
        </div>
        <?php
    }
}

new AIWidgetPlugin();
?>

<!-- Method 4: Using Gutenberg block (for block themes) -->
<!-- This would require creating a custom block plugin -->`;
  }

  private generateShopifyGuide(config: DeploymentConfig): string {
    return `<!-- Shopify Integration -->

<!-- Method 1: Theme Liquid Files -->
<!-- Add to your theme's layout/theme.liquid before closing </body> tag -->
${config.embedCode}

<!-- Method 2: Using Shopify Scripts API -->
<!-- Create a new script tag in your Shopify admin -->
<!-- Go to Online Store > Themes > Actions > Edit Code -->
<!-- Edit layout/theme.liquid and add: -->

{% comment %} AI Widget Integration {% endcomment %}
${config.embedCode}

<!-- Method 3: Custom App Integration -->
<!-- If building a Shopify app, add to your app's frontend: -->

// In your app's JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // Check if we're in the Shopify admin or storefront
    if (window.Shopify && window.Shopify.shop) {
        // Load widget with Shopify-specific configuration
        const script = document.createElement('script');
        script.src = '${config.scriptUrl}';
        script.setAttribute('data-agent-id', '${config.agentId}');
        script.setAttribute('data-shopify-shop', window.Shopify.shop);
        script.setAttribute('data-theme', '${config.widgetConfig.theme || 'light'}');
        
        // Shopify-specific positioning
        script.setAttribute('data-position', 'bottom-right');
        script.setAttribute('data-z-index', '999999');
        
        document.body.appendChild(script);
    }
});

<!-- Method 4: Liquid Template Integration -->
<!-- For product pages, add to templates/product.liquid: -->
<script>
// Product-specific widget configuration
window.aiWidgetConfig = {
    agentId: '${config.agentId}',
    context: {
        product: {
            id: {{ product.id }},
            title: "{{ product.title | escape }}",
            price: "{{ product.price | money }}",
            available: {{ product.available }}
        },
        shop: "{{ shop.name | escape }}"
    }
};
</script>
${config.embedCode}`;
  }

  // Validation and Testing
  async validateDeployment(config: DeploymentConfig): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
    recommendations: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Validate script URL
    try {
      const response = await fetch(config.scriptUrl, { method: 'HEAD' });
      if (!response.ok) {
        errors.push(`Script URL is not accessible: ${config.scriptUrl}`);
      }
    } catch {
      errors.push(`Cannot reach script URL: ${config.scriptUrl}`);
    }

    // Validate agent ID format
    if (!config.agentId || config.agentId.length < 3) {
      errors.push('Agent ID is required and must be at least 3 characters');
    }

    // Check for common issues
    if (config.widgetConfig.zIndex && config.widgetConfig.zIndex < 1000) {
      warnings.push('Z-index is quite low, widget might appear behind other elements');
    }

    if (!config.widgetConfig.greeting) {
      recommendations.push('Consider adding a custom greeting message');
    }

    if (!config.analytics.enabled) {
      recommendations.push('Enable analytics to track widget performance');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      recommendations,
    };
  }

  // Generate deployment package
  generateDeploymentPackage(config: DeploymentConfig): {
    files: { [filename: string]: string };
    instructions: string;
  } {
    const files: { [filename: string]: string } = {};

    // Generate embed code file
    files['embed-code.html'] = config.embedCode;

    // Generate integration examples
    files['integration-examples.md'] = this.generateIntegrationMarkdown(config);

    // Generate test page
    files['test-page.html'] = this.generateTestPage(config);

    // Generate configuration file
    files['widget-config.json'] = JSON.stringify(config, null, 2);

    const instructions = `
# AI Widget Deployment Package

## Quick Start
1. Copy the embed code from 'embed-code.html'
2. Paste it before the closing </body> tag of your website
3. Test using 'test-page.html'

## Files Included
- embed-code.html: Ready-to-use embed code
- integration-examples.md: Integration guides for different platforms
- test-page.html: Test page to verify widget functionality
- widget-config.json: Complete configuration details

## Support
For technical support, visit: https://docs.aiagent.com
`;

    return { files, instructions };
  }

  private generateIntegrationMarkdown(config: DeploymentConfig): string {
    const guide = this.generateIntegrationGuide(config);
    
    return `# AI Widget Integration Guide

## HTML Integration
\`\`\`html
${guide.html}
\`\`\`

## JavaScript Integration
\`\`\`javascript
${guide.javascript}
\`\`\`

## React Integration
\`\`\`jsx
${guide.react}
\`\`\`

## Vue.js Integration
\`\`\`vue
${guide.vue}
\`\`\`

## Angular Integration
\`\`\`typescript
${guide.angular}
\`\`\`

## WordPress Integration
\`\`\`php
${guide.wordpress}
\`\`\`

## Shopify Integration
\`\`\`liquid
${guide.shopify}
\`\`\`
`;
  }

  private generateTestPage(config: DeploymentConfig): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Widget Test Page</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        .container { max-width: 800px; margin: 0 auto; }
        .test-section { margin: 20px 0; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
        button { padding: 10px 20px; margin: 5px; border: none; border-radius: 4px; cursor: pointer; }
        .primary { background: #007cba; color: white; }
        .secondary { background: #666; color: white; }
    </style>
</head>
<body>
    <div class="container">
        <h1>AI Widget Test Page</h1>
        
        <div class="test-section">
            <h2>Widget Information</h2>
            <p><strong>Agent ID:</strong> ${config.agentId}</p>
            <p><strong>Theme:</strong> ${config.widgetConfig.theme || 'light'}</p>
            <p><strong>Position:</strong> ${config.widgetConfig.position || 'bottom-right'}</p>
            <p><strong>Voice Enabled:</strong> ${config.widgetConfig.voiceEnabled ? 'Yes' : 'No'}</p>
        </div>

        <div class="test-section">
            <h2>Test Controls</h2>
            <p>Use these buttons to test widget functionality:</p>
            <button class="primary" onclick="testShowWidget()">Show Widget</button>
            <button class="secondary" onclick="testHideWidget()">Hide Widget</button>
            <button class="primary" onclick="testToggleWidget()">Toggle Widget</button>
            <button class="secondary" onclick="testSendMessage()">Send Test Message</button>
        </div>

        <div class="test-section">
            <h2>Integration Status</h2>
            <div id="status">Loading...</div>
        </div>
    </div>

    ${config.embedCode}

    <script>
        // Test functions
        function testShowWidget() {
            if (window.AIWidget) {
                // Implementation depends on how global access is provided
                console.log('Show widget called');
            } else {
                alert('Widget not loaded yet');
            }
        }

        function testHideWidget() {
            console.log('Hide widget called');
        }

        function testToggleWidget() {
            console.log('Toggle widget called');
        }

        function testSendMessage() {
            console.log('Send test message called');
        }

        // Check widget status
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(function() {
                const statusDiv = document.getElementById('status');
                if (window.AIWidget) {
                    statusDiv.innerHTML = '<span style="color: green;">✓ Widget loaded successfully</span>';
                } else {
                    statusDiv.innerHTML = '<span style="color: red;">✗ Widget failed to load</span>';
                }
            }, 2000);
        });
    </script>
</body>
</html>`;
  }
}