import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Template } from '@/lib/templates';
import { TemplateCard } from './TemplateCard';
import { TemplateContextMenu } from './TemplateContextMenu';

interface QuickTemplatesSectionProps {
  templates: Template[];
  onTemplatePress: (template: Template) => void;
  onEditTemplate: (template: Template) => void;
  onDeleteTemplate: (template: Template) => void;
  loading?: boolean;
}

export const QuickTemplatesSection = React.memo(function QuickTemplatesSection({
  templates,
  onTemplatePress,
  onEditTemplate,
  onDeleteTemplate,
  loading = false,
}: QuickTemplatesSectionProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [displayedCount, setDisplayedCount] = useState(6);

  // Memoize filtered and sorted templates
  const activeTemplates = useMemo(() => {
    return templates
      .filter((t) => t.is_deleted === 0)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, displayedCount);
  }, [templates, displayedCount]);

  const handleTemplatePress = useCallback((template: Template) => {
    onTemplatePress(template);
  }, [onTemplatePress]);

  const handleTemplateLongPress = useCallback((template: Template) => {
    setSelectedTemplate(template);
    setMenuVisible(true);
  }, []);

  const handleEdit = useCallback(() => {
    if (selectedTemplate) {
      onEditTemplate(selectedTemplate);
      setMenuVisible(false);
    }
  }, [selectedTemplate, onEditTemplate]);

  const handleDelete = useCallback(() => {
    if (selectedTemplate) {
      onDeleteTemplate(selectedTemplate);
      setMenuVisible(false);
    }
  }, [selectedTemplate, onDeleteTemplate]);

  const handleScroll = useCallback(
    (event) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      if (contentOffset.x + layoutMeasurement.width >= contentSize.width - 100) {
        setDisplayedCount((prev) => Math.min(prev + 6, templates.length));
      }
    },
    [templates.length]
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Quick Templates</Text>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#1e3a8a" />
        </View>
      </View>
    );
  }

  if (activeTemplates.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Quick Templates</Text>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No templates yet. Create one to get started.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Quick Templates</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={handleScroll}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {activeTemplates.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            onPress={handleTemplatePress}
            onLongPress={handleTemplateLongPress}
          />
        ))}
      </ScrollView>

      {selectedTemplate && (
        <TemplateContextMenu
          template={selectedTemplate}
          visible={menuVisible}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onDismiss={() => setMenuVisible(false)}
        />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#666',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  scrollView: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  scrollContent: {
    paddingRight: 16,
  },
  loadingContainer: {
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});
