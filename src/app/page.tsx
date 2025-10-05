"use client";

import React from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import { motion } from 'framer-motion';
import { MapPin } from 'lucide-react';

const cityData = [
  { name: 'Urumqi', x: 15, y: 70 },
  { name: 'Lhasa', x: 28, y: 30 },
  { name: 'Chengdu', x: 42, y: 35 },
  { name: 'Xi\'an', x: 53, y: 45 },
  { name: 'Beijing', x: 68, y: 70 },
  { name: 'Harbin', x: 80, y: 85 },
  { name: 'Shanghai', x: 80, y: 40 },
  { name: 'Guangzhou', x: 63, y: 15 },
  { name: 'Hong Kong', x: 65, y: 12 },
  { name: 'Taipei', x: 82, y: 25 },
  { name: 'Wuhan', x: 62, y: 38},
];

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="p-2 bg-gray-800 text-white rounded-md shadow-lg border border-gray-600">
        <p className="font-bold">{payload[0].payload.name}</p>
      </div>
    );
  }
  return null;
};

const renderCustomDot = (props: any) => {
  const { cx, cy, payload } = props;
  const isMajorCity = ['Beijing', 'Shanghai', 'Guangzhou'].includes(payload.name);

  return (
    <g>
      <motion.circle
        cx={cx}
        cy={cy}
        r={isMajorCity ? 8 : 5}
        fill={isMajorCity ? 'rgba(59, 130, 246, 0.7)' : 'rgba(13, 189, 156, 0.7)'}
        stroke={isMajorCity ? '#3B82F6' : '#0DBD9C'}
        strokeWidth={2}
        initial={{ r: 0, opacity: 0 }}
        animate={{ r: isMajorCity ? 8 : 5, opacity: 1 }}
        transition={{ duration: 0.5, delay: Math.random() * 0.5 }}
      />
    </g>
  );
};

export default function ChinaMapPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4 overflow-hidden">
       <div className="absolute inset-0 z-0 opacity-10">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500 rounded-full filter blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-teal-500 rounded-full filter blur-3xl"></div>
      </div>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-8 z-10"
      >
        <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-teal-300">
          National Map of China
        </h1>
        <p className="text-lg text-gray-400 mt-2">A conceptual representation of major cities</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, delay: 0.3 }}
        className="w-full max-w-4xl h-[60vh] bg-gray-800/30 rounded-xl shadow-2xl border border-gray-700 p-4 backdrop-blur-sm z-10"
      >
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart
            margin={{
              top: 30,
              right: 30,
              bottom: 30,
              left: 30,
            }}
          >
            <XAxis type="number" dataKey="x" hide domain={[0, 100]} />
            <YAxis type="number" dataKey="y" hide domain={[0, 100]} />
            <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3', stroke: '#4A5568' }} />
            <Scatter name="Cities" data={cityData} fill="#8884d8" shape={renderCustomDot}>
                <LabelList dataKey="name" position="top" offset={10} className="fill-gray-400 text-xs" />
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </motion.div>
    </div>
  );
}
