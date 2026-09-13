import { PromptCompiler } from './promptCompiler';

export class PromptTemplateService extends PromptCompiler {
  /**
   * Fetches an active prompt template for an organization and compiles it.
   */
  static async loadAndCompile(params: {
    templateId: string;
    orgId: string;
    version?: number;
    variables: Record<string, any>;
    untrustedContext?: string;
  }) {
    const { db } = await import('@/db');
    const tmpl = await db.getPromptTemplate(params.templateId, params.orgId);
    if (!tmpl) {
      throw new Error(`Prompt template ${params.templateId} not found for organization ${params.orgId}`);
    }

    const versionNum = params.version || tmpl.active_version;
    const version = (tmpl.versions || []).find(v => v.version === versionNum);
    if (!version) {
      throw new Error(`Version ${versionNum} not found for prompt template ${params.templateId}`);
    }

    const compiled = this.compilePrompt({
      systemPrompt: version.system_prompt,
      userTemplate: version.user_template,
      variables: params.variables,
      untrustedContext: params.untrustedContext,
    });

    return {
      template: tmpl,
      version,
      ...compiled,
    };
  }
}
