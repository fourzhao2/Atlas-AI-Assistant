import type { HistoryInsight } from '@/types';
import { storage } from '@/services/storage';
import { aiService } from '@/services/ai-service';

class HistoryAnalyzer {
  private analyzing = false;

  async analyzeHistory(): Promise<HistoryInsight[]> {
    if (this.analyzing) {
      console.log('Analysis already in progress');
      return [];
    }

    this.analyzing = true;

    try {
      // Get browsing history from the last 7 days
      const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const historyItems = await chrome.history.search({
        text: '',
        startTime: oneWeekAgo,
        maxResults: 500,
      });

      if (historyItems.length === 0) {
        return [];
      }

      // Group by domain
      const domainStats = this.groupByDomain(historyItems);
      
      // Get top domains
      const topDomains = Object.entries(domainStats)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 10);

      // Create trend insight
      const trendInsight = await storage.addInsight({
        type: 'trend',
        title: '本周浏览趋势',
        description: `您在过去7天访问了 ${historyItems.length} 个页面，主要集中在 ${topDomains[0]?.[0] || '未知'} 等网站。`,
        data: {
          totalPages: historyItems.length,
          topDomains: topDomains.map(([domain, stats]) => ({
            domain,
            count: stats.count,
            titles: stats.titles.slice(0, 3),
          })),
        },
      });

      // Analyze patterns with AI
      const aiInsights = await this.getAIInsights(historyItems, topDomains);

      return [trendInsight, ...aiInsights];
    } catch (error) {
      console.error('History analysis failed:', error);
      return [];
    } finally {
      this.analyzing = false;
    }
  }

  private groupByDomain(historyItems: chrome.history.HistoryItem[]): Record<string, { count: number; titles: string[] }> {
    const stats: Record<string, { count: number; titles: string[] }> = {};

    historyItems.forEach(item => {
      if (!item.url) return;

      try {
        const url = new URL(item.url);
        const domain = url.hostname.replace(/^www\./, '');

        if (!stats[domain]) {
          stats[domain] = { count: 0, titles: [] };
        }

        stats[domain].count++;
        
        if (item.title && stats[domain].titles.length < 5) {
          stats[domain].titles.push(item.title);
        }
      } catch (e) {
        // Skip invalid URLs
      }
    });

    return stats;
  }

  private async getAIInsights(
    _historyItems: chrome.history.HistoryItem[],
    topDomains: [string, { count: number; titles: string[] }][]
  ): Promise<HistoryInsight[]> {
    try {
      // Prepare data for AI
      const summary = topDomains
        .slice(0, 5)
        .map(([domain, stats]) => `${domain}: ${stats.count} visits - ${stats.titles.slice(0, 2).join(', ')}`)
        .join('\n');

      const prompt = `Based on this browsing history from the past week, provide 2-3 helpful insights or suggestions in Chinese (简体中文).

Browsing data:
${summary}

Format your response as JSON array:
[
  {
    "title": "洞察标题",
    "description": "详细描述和建议"
  }
]`;

      let response = '';
      await aiService.chat([{ role: 'user', content: prompt }], (chunk) => {
        response += chunk;
      });

      // Parse AI response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const insights: HistoryInsight[] = [];

        for (const item of parsed) {
          const insight = await storage.addInsight({
            type: 'suggestion',
            title: item.title,
            description: item.description,
          });
          insights.push(insight);
        }

        return insights;
      }
    } catch (error) {
      console.error('AI insights generation failed:', error);
    }

    return [];
  }

  private intervalId: number | null = null;

  async scheduleAnalysis() {
    // Run analysis once per day
    const ANALYSIS_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

    const analyze = async () => {
      try {
        const insights = await this.analyzeHistory();
        console.log(`Generated ${insights.length} insights`);
      } catch (error) {
        console.error('[HistoryAnalyzer] Analysis failed:', error);
      }
    };

    // Run immediately
    analyze().catch(error => {
      console.error('[HistoryAnalyzer] Initial analysis failed:', error);
    });

    // Clear existing interval if any
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
    }

    // Schedule periodic analysis
    this.intervalId = setInterval(analyze, ANALYSIS_INTERVAL) as unknown as number;
  }

  stopSchedule() {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

export const historyAnalyzer = new HistoryAnalyzer();

