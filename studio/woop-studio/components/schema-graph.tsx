"use client";

import { useEffect, useMemo } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Position,
  MarkerType,
  Node,
  Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { useTheme } from "next-themes";

interface SchemaGraphProps {
  tables: {
    tableName: string;
    columns: { name: string; type: string; isPk: boolean }[];
  }[];
  relationships: {
    fromTable: string;
    fromColumn: string;
    toTable: string;
    toColumn: string;
  }[];
}

const nodeWidth = 240; // Slightly wider for better spacing

const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  dagreGraph.setGraph({ rankdir: 'LR' });

  nodes.forEach((node) => {
    // Estimate height based on columns (header + columns * row height)
    // Header ~ 36px, Row ~ 33px (with padding/border)
    const height = 36 + (node.data.columns as any[]).length * 33 + 10;
    dagreGraph.setNode(node.id, { width: nodeWidth, height: height });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeWithPosition.height / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

// Custom Node Component
const TableNode = ({ data }: { data: any }) => {
  return (
    <div className="bg-card border border-border rounded-md shadow-sm min-w-[200px] overflow-hidden">
      <div className="bg-muted/50 p-2 border-b border-border font-semibold text-sm flex items-center justify-between text-card-foreground">
        <span>{data.label}</span>
      </div>
      <div className="flex flex-col bg-card">
        {data.columns.map((col: any, index: number) => (
          <div 
            key={col.name} 
            className={`flex justify-between text-xs items-center p-2 hover:bg-muted/50 transition-colors ${
              index !== data.columns.length - 1 ? 'border-b border-border' : ''
            }`}
          >
            <div className="flex items-center gap-2">
                <span 
                    className={col.isPk ? "text-yellow-500" : "opacity-0"} 
                    title={col.isPk ? "Primary Key" : ""}
                >
                    🔑
                </span>
                <span className={col.isPk ? "font-bold text-foreground" : "text-foreground"}>
                    {col.name}
                </span>
            </div>
            <span className="text-muted-foreground ml-4 text-[10px]">{col.type}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const nodeTypes = {
  table: TableNode,
};

export function SchemaGraph({ tables, relationships }: SchemaGraphProps) {
  const { theme, resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    const nodes: Node[] = tables.map((t) => ({
      id: t.tableName,
      type: 'table',
      data: { 
        label: t.tableName, 
        columns: t.columns 
      },
      position: { x: 0, y: 0 }, 
    }));

    const edges: Edge[] = relationships.map((r, i) => ({
      id: `e-${i}`,
      source: r.fromTable,
      target: r.toTable,
      sourceHandle: r.fromColumn, 
      targetHandle: r.toColumn,   
      animated: true,
      style: { stroke: isDark ? 'hsl(var(--primary))' : '#000' },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: isDark ? 'hsl(var(--primary))' : '#000',
      },
      label: `${r.fromColumn} -> ${r.toColumn}`,
      labelStyle: { fill: isDark ? 'hsl(var(--muted-foreground))' : '#666', fontSize: 10 },
      labelBgStyle: { fill: isDark ? 'hsl(var(--background))' : '#fff', fillOpacity: 0.8 },
    }));

    return getLayoutedElements(nodes, edges);
  }, [tables, relationships, isDark]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
      setNodes(initialNodes);
      setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  return (
    <div style={{ width: '100%', height: 'calc(100vh - 60px)' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.1}
        colorMode={isDark ? 'dark' : 'light'}
      >
        <Controls 
            className="!bg-card !border-border !fill-foreground"
        />
        <MiniMap 
            style={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
            nodeColor={isDark ? 'hsl(var(--muted))' : '#eee'}
            maskColor={isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)'}
        />
        <Background 
            gap={16} 
            size={1} 
            color={isDark ? '#444' : '#ddd'}
        />
      </ReactFlow>
    </div>
  );
}
