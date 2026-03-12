import React from 'react';
import { Alert, Modal, TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Template } from '@/lib/templates';
import { Edit2, Trash2 } from 'lucide-react-native';

interface TemplateContextMenuProps {
  template: Template;
  visible: boolean;
  onEdit: (template: Template) => void;
  onDelete: (template: Template) => void;
  onDismiss: () => void;
}

export function TemplateContextMenu({
  template,
  visible,
  onEdit,
  onDelete,
  onDismiss,
}: TemplateContextMenuProps) {
  const handleDelete = () => {
    Alert.alert(
      'Delete Template',
      `Are you sure you want to delete "${template.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            onDelete(template);
            onDismiss();
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onDismiss}>
        <View style={styles.menu}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              onEdit(template);
              onDismiss();
            }}
          >
            <Edit2 size={18} color="#1e3a8a" />
            <Text style={styles.menuItemText}>Edit</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.menuItem} onPress={handleDelete}>
            <Trash2 size={18} color="#ef4444" />
            <Text style={[styles.menuItemText, { color: '#ef4444' }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menu: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    overflow: 'hidden',
    minWidth: 150,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e3a8a',
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
  },
});
