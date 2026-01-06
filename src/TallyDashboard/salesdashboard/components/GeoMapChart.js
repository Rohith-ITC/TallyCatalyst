import React, { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';
import { PINCODE_COORDINATES } from '../data/pincodeCoordinates';
import indiaStatesGeoJSON from '../data/indiaStates.json';
import worldCountriesGeoJSON from '../data/worldCountries.json';

// Try to import pincode shapefile, fallback to null if not available
let indiaPincodesGeoJSON = null;
try {
  indiaPincodesGeoJSON = require('../data/indiaPincodes.json');
} catch (e) {
  console.warn('⚠️ Pincode shapefile not found. Pincode choropleth maps will not be available.');
}

const GeoMapChart = ({
  mapType = 'state', // 'pincode' | 'state' | 'country'
  chartSubType = 'choropleth', // 'scatter' | 'choropleth'
  data = [], // [{name: string, value: number}]
  height = 500,
  isMobile = false,
  onRegionClick,
  onBackClick,
  showBackButton = false,
  customHeader,
}) => {
  const chartRef = useRef(null);
  const instanceRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const [isMapRegistered, setIsMapRegistered] = useState(false);

  // Register maps with ECharts
  useEffect(() => {
    if (mapType === 'state' && !echarts.getMap('india')) {
      // Register with nameProperty to tell ECharts which property to use for matching
      echarts.registerMap('india', indiaStatesGeoJSON, {
        nameProperty: 'STATE'
      });
      
      // Log available STATE values for debugging
      const stateNames = indiaStatesGeoJSON.features.map(f => f.properties.STATE).filter(Boolean);
      console.log('🗺️ Registered India map with STATE property');
      console.log('🗺️ Available STATE names in GeoJSON:', stateNames.sort());
      setIsMapRegistered(true);
    } else if (mapType === 'country' && !echarts.getMap('world')) {
      // Register with nameProperty to tell ECharts which property to use for matching
      echarts.registerMap('world', worldCountriesGeoJSON, {
        nameProperty: 'name'
      });
      
      // Log available country names for debugging
      const countryNames = worldCountriesGeoJSON.features.map(f => f.properties.name).filter(Boolean);
      console.log('🗺️ Registered World map with name property');
      console.log('🗺️ Available country names in GeoJSON:', countryNames.slice(0, 20).sort());
      setIsMapRegistered(true);
    } else if (mapType === 'pincode') {
      if (chartSubType === 'choropleth' && indiaPincodesGeoJSON && !echarts.getMap('indiaPincodes')) {
        // Register pincode shapefile for choropleth maps
        echarts.registerMap('indiaPincodes', indiaPincodesGeoJSON, {
          nameProperty: 'pincode'
        });
        
        // Log available pincode count for debugging
        const pincodeCount = indiaPincodesGeoJSON.features.length;
        console.log('🗺️ Registered India Pincode map with pincode property');
        console.log(`🗺️ Total pincodes in GeoJSON: ${pincodeCount}`);
        setIsMapRegistered(true);
      } else if (chartSubType === 'scatter' && !echarts.getMap('india')) {
        // For pincode scatter, we still need India base map
        echarts.registerMap('india', indiaStatesGeoJSON, {
          nameProperty: 'STATE'
        });
        setIsMapRegistered(true);
      } else {
        setIsMapRegistered(true);
      }
    } else {
      setIsMapRegistered(true);
    }
  }, [mapType]);

  // Initialize ECharts instance with dimension checking
  useEffect(() => {
    if (!chartRef.current || !isMapRegistered) return;

    // Check if container has dimensions
    const checkDimensions = () => {
      if (!chartRef.current) return false;
      const containerWidth = chartRef.current.clientWidth;
      const containerHeight = chartRef.current.clientHeight;
      return containerWidth > 0 && containerHeight > 0;
    };

    // Initialize chart once container has dimensions
    if (checkDimensions() && !instanceRef.current) {
      try {
        instanceRef.current = echarts.init(chartRef.current, null, { renderer: 'svg' });
        setIsReady(true);
      } catch (error) {
        console.error('Failed to initialize ECharts:', error);
      }
    } else if (!checkDimensions()) {
      // Retry after container is ready
      const timer = setTimeout(() => {
        if (checkDimensions() && !instanceRef.current) {
          try {
            instanceRef.current = echarts.init(chartRef.current, null, { renderer: 'svg' });
            setIsReady(true);
          } catch (error) {
            console.error('Failed to initialize ECharts:', error);
          }
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isMapRegistered]);

  // Prepare data for the map
  useEffect(() => {
    if (!isReady || !instanceRef.current) return;
    
    // Show error message if no data
    if (!data || data.length === 0) {
      if (instanceRef.current) {
        const emptyOption = {
          title: {
            text: 'No Data Available',
            left: 'center',
            top: 'middle',
            textStyle: {
              fontSize: 16,
              color: '#666'
            }
          }
        };
        instanceRef.current.setOption(emptyOption, true);
      }
      return;
    }

    let option = {};

    if (mapType === 'pincode' && chartSubType === 'scatter') {
      // Pincode Scatter Map
      // Normalize pincode names (remove spaces, ensure string format)
      const normalizePincode = (pincode) => {
        if (!pincode) return null;
        // Convert to string, remove spaces, trim
        return String(pincode).replace(/\s+/g, '').trim();
      };

      const scatterData = data
        .map(item => {
          const normalizedPincode = normalizePincode(item.name);
          if (!normalizedPincode) return null;
          
          const coords = PINCODE_COORDINATES[normalizedPincode];
          if (coords && Array.isArray(coords) && coords.length >= 2) {
            return {
              name: normalizedPincode,
              value: [coords[0], coords[1], item.value], // [lng, lat, value]
            };
          }
          return null;
        })
        .filter(Boolean);

      // Calculate value range for visualMap and symbolSize
      const dataValues = data.map(d => d.value).filter(v => v != null && !isNaN(v));
      const minValue = dataValues.length > 0 ? Math.min(...dataValues) : 0;
      const maxValue = dataValues.length > 0 ? Math.max(...dataValues) : 100;
      const valueRange = maxValue - minValue || 1;

      // Log for debugging
      const unmatchedPincodes = data
        .map(item => {
          const normalized = normalizePincode(item.name);
          if (!normalized) return item.name;
          if (!PINCODE_COORDINATES[normalized]) return item.name;
          return null;
        })
        .filter(Boolean);
      
      console.log('🗺️ Pincode Scatter Map:', {
        totalDataPoints: data.length,
        mappedPoints: scatterData.length,
        unmatchedCount: unmatchedPincodes.length,
        valueRange: { min: minValue, max: maxValue },
        sampleData: scatterData.slice(0, 3),
        unmatchedSample: unmatchedPincodes.slice(0, 5),
        samplePincodeLookups: data.slice(0, 3).map(item => ({
          original: item.name,
          normalized: normalizePincode(item.name),
          found: !!PINCODE_COORDINATES[normalizePincode(item.name)]
        }))
      });
      
      if (scatterData.length === 0) {
        console.warn('⚠️ No pincode coordinates found! Check if pincode names match the coordinate dataset.');
      }

      option = {
        tooltip: {
          trigger: 'item',
          formatter: (params) => {
            if (params.componentSubType === 'scatter') {
              const value = params.value && params.value.length >= 3 ? params.value[2] : 'N/A';
              return `<strong>PIN Code:</strong> ${params.name}<br/><strong>Value:</strong> ${typeof value === 'number' ? value.toLocaleString() : value}`;
            }
            return params.name;
          },
          textStyle: {
            fontSize: isMobile ? 11 : 12,
          },
        },
        geo: {
          map: 'india',
          roam: true,
          zoom: 1.2,
          label: {
            show: false,
          },
          itemStyle: {
            areaColor: '#f3f3f3',
            borderColor: '#999',
            borderWidth: 0.5,
          },
          emphasis: {
            itemStyle: {
              areaColor: '#e0e0e0',
              borderColor: '#666',
              borderWidth: 1,
            },
          },
        },
        visualMap: {
          type: 'continuous',
          min: minValue,
          max: maxValue,
          text: ['High', 'Low'],
          realtime: false,
          calculable: true,
          seriesIndex: [0], // Link to scatter series
          dimension: 2, // Use the 3rd element (value) in [lng, lat, value] for color mapping
          inRange: {
            color: ['#e0f3ff', '#006eb8'], // Light blue to dark blue
          },
          outOfRange: {
            color: '#e0f3ff', // Default color for values outside range
          },
          textStyle: {
            fontSize: isMobile ? 10 : 11,
          },
          left: isMobile ? 10 : 20,
          bottom: isMobile ? 20 : 30,
        },
        series: [
          {
            name: 'PIN Code Data',
            type: 'scatter',
            coordinateSystem: 'geo',
            data: scatterData,
            symbol: 'circle',
            symbolSize: (val) => {
              // Size based on value intensity
              const maxSize = isMobile ? 35 : 50;
              const minSize = isMobile ? 8 : 12; // Increased minimum size for visibility
              const pointValue = val && val.length >= 3 ? val[2] : minValue;
              const normalizedValue = (pointValue - minValue) / valueRange;
              return minSize + (normalizedValue * (maxSize - minSize));
            },
            itemStyle: {
              borderColor: '#fff',
              borderWidth: 1.5,
              opacity: 0.85,
            },
            label: {
              show: false,
            },
            emphasis: {
              label: {
                show: true,
                formatter: '{b}',
                position: 'top',
                fontSize: isMobile ? 10 : 11,
                color: '#333',
              },
              itemStyle: {
                borderColor: '#000',
                borderWidth: 2,
              },
            },
          },
        ],
      };
    } else if (mapType === 'pincode' && chartSubType === 'choropleth') {
      // Pincode Choropleth Map (using shapefile)
      if (!indiaPincodesGeoJSON) {
        console.warn('⚠️ Pincode shapefile not available. Falling back to scatter map.');
        // Fallback to scatter map if shapefile is not available
        // This will be handled by the scatter map logic below
        // For now, show a message and use scatter
        const normalizePincode = (pincode) => {
          if (!pincode) return null;
          return String(pincode).replace(/\s+/g, '').trim();
        };

        const scatterData = data
          .map(item => {
            const normalizedPincode = normalizePincode(item.name);
            if (!normalizedPincode) return null;
            
            const coords = PINCODE_COORDINATES[normalizedPincode];
            if (coords && Array.isArray(coords) && coords.length >= 2) {
              return {
                name: normalizedPincode,
                value: [coords[0], coords[1], item.value], // [lng, lat, value]
              };
            }
            return null;
          })
          .filter(Boolean);

        if (scatterData.length === 0) {
          // No coordinates available either - show error
          option = {
            title: {
              text: 'Pincode Shapefile Not Available',
              subtext: 'Please convert the shapefile to use choropleth maps.\nOr ensure pincode coordinates are available for scatter maps.',
              left: 'center',
              top: 'middle',
              textStyle: {
                fontSize: 16,
                color: '#666'
              },
              subtextStyle: {
                fontSize: 12,
                color: '#999',
                lineHeight: 20
              }
            }
          };
          try {
            instanceRef.current.setOption(option, true);
          } catch (error) {
            console.error('Failed to set error option:', error);
          }
          return;
        }
        
        // Use scatter map as fallback
        const dataValues = data.map(d => d.value).filter(v => v != null && !isNaN(v));
        const minValue = dataValues.length > 0 ? Math.min(...dataValues) : 0;
        const maxValue = dataValues.length > 0 ? Math.max(...dataValues) : 100;
        const valueRange = maxValue - minValue || 1;

        option = {
          tooltip: {
            trigger: 'item',
            formatter: (params) => {
              if (params.componentSubType === 'scatter') {
                const value = params.value && params.value.length >= 3 ? params.value[2] : 'N/A';
                return `<strong>PIN Code:</strong> ${params.name}<br/><strong>Value:</strong> ${typeof value === 'number' ? value.toLocaleString() : value}`;
              }
              return params.name;
            },
            textStyle: {
              fontSize: isMobile ? 11 : 12,
            },
          },
          geo: {
            map: 'india',
            roam: true,
            zoom: 1.2,
            label: {
              show: false,
            },
            itemStyle: {
              areaColor: '#f3f3f3',
              borderColor: '#999',
              borderWidth: 0.5,
            },
            emphasis: {
              itemStyle: {
                areaColor: '#e0e0e0',
                borderColor: '#666',
                borderWidth: 1,
              },
            },
          },
          visualMap: {
            type: 'continuous',
            min: minValue,
            max: maxValue,
            text: ['High', 'Low'],
            realtime: false,
            calculable: true,
            seriesIndex: [0],
            dimension: 2,
            inRange: {
              color: ['#e0f3ff', '#006eb8'],
            },
            outOfRange: {
              color: '#e0f3ff',
            },
            textStyle: {
              fontSize: isMobile ? 10 : 11,
            },
            left: isMobile ? 10 : 20,
            bottom: isMobile ? 20 : 30,
          },
          series: [
            {
              name: 'PIN Code Data',
              type: 'scatter',
              coordinateSystem: 'geo',
              data: scatterData,
              symbol: 'circle',
              symbolSize: (val) => {
                const maxSize = isMobile ? 35 : 50;
                const minSize = isMobile ? 8 : 12;
                const pointValue = val && val.length >= 3 ? val[2] : minValue;
                const normalizedValue = (pointValue - minValue) / valueRange;
                return minSize + (normalizedValue * (maxSize - minSize));
              },
              itemStyle: {
                borderColor: '#fff',
                borderWidth: 1.5,
                opacity: 0.85,
              },
              label: {
                show: false,
              },
              emphasis: {
                label: {
                  show: true,
                  formatter: '{b}',
                  position: 'top',
                  fontSize: isMobile ? 10 : 11,
                  color: '#333',
                },
                itemStyle: {
                  borderColor: '#000',
                  borderWidth: 2,
                },
              },
            },
          ],
        };
      } else {
        // Shapefile is available - use choropleth map
      
      const mapName = 'indiaPincodes';
      
      // Normalize pincode names (remove spaces, ensure string format)
      const normalizePincode = (pincode) => {
        if (!pincode) return '';
        return String(pincode).replace(/\s+/g, '').trim();
      };
      
      // Normalize data names to match GeoJSON properties
      const normalizedData = data.map(item => {
        const normalized = normalizePincode(item.name);
        return {
          name: normalized,
          value: item.value,
        };
      });
      
      // Calculate min/max for visualMap, handle empty data
      const dataValues = data.map(d => d.value).filter(v => v != null && !isNaN(v));
      let minValue = dataValues.length > 0 ? Math.min(...dataValues) : 0;
      let maxValue = dataValues.length > 0 ? Math.max(...dataValues) : 100;
      
      // If min === max, add a small range to ensure visualMap works
      if (minValue === maxValue && minValue !== 0) {
        minValue = minValue * 0.9;
        maxValue = maxValue * 1.1;
      } else if (minValue === maxValue && minValue === 0) {
        maxValue = 100; // Default range when all values are 0
      }

      // Get all pincode names from GeoJSON for matching verification
      const geoJsonPincodeNames = indiaPincodesGeoJSON.features
        .map(f => f.properties.pincode || f.properties.PINCODE)
        .filter(Boolean);
      
      // Check which data points match GeoJSON pincodes
      const matchedPincodes = normalizedData.filter(d => 
        geoJsonPincodeNames.includes(d.name)
      );
      const unmatchedPincodes = normalizedData.filter(d => 
        !geoJsonPincodeNames.includes(d.name)
      );

      // Log matching information for debugging
      console.log('🗺️ Pincode Choropleth Map Configuration:', {
        totalDataPoints: normalizedData.length,
        matchedPincodes: matchedPincodes.length,
        unmatchedPincodes: unmatchedPincodes.length,
        unmatchedSample: unmatchedPincodes.slice(0, 5).map(d => d.name),
        dataSample: normalizedData.slice(0, 5),
        valueRange: { min: minValue, max: maxValue },
        mapName,
        nameProperty: 'pincode',
        geoJsonPincodeCount: geoJsonPincodeNames.length
      });
      
      if (unmatchedPincodes.length > 0) {
        console.warn('🗺️ Unmatched pincode names (will not show colors):', unmatchedPincodes.slice(0, 10).map(d => d.name));
      }

      option = {
        tooltip: {
          trigger: 'item',
          formatter: (params) => {
            if (params.value != null && params.value !== undefined) {
              return `<strong>PIN Code: ${params.name}</strong><br/><strong>Value:</strong> ${params.value.toLocaleString()}`;
            }
            return `<strong>PIN Code: ${params.name}</strong><br/>No data available`;
          },
          textStyle: {
            fontSize: isMobile ? 11 : 12,
          },
        },
        visualMap: {
          type: 'continuous',
          min: minValue,
          max: maxValue,
          text: ['High', 'Low'],
          realtime: false,
          calculable: true,
          seriesIndex: [0],
          inRange: {
            color: ['#e0f3ff', '#006eb8'], // Light blue to dark blue gradient
          },
          outOfRange: {
            color: '#f0f0f0', // Light grey for regions without data
          },
          textStyle: {
            fontSize: isMobile ? 10 : 11,
          },
          left: isMobile ? 10 : 20,
          bottom: isMobile ? 20 : 30,
        },
        series: [
          {
            name: 'PIN Code',
            type: 'map',
            map: mapName,
            roam: true,
            zoom: 1.2,
            nameProperty: 'pincode',
            label: {
              show: false, // Hide labels by default to reduce clutter
              fontSize: isMobile ? 8 : 9,
            },
            itemStyle: {
              areaColor: '#f0f0f0',
              borderColor: '#999',
              borderWidth: 0.3,
            },
            emphasis: {
              label: {
                show: true,
                fontSize: isMobile ? 10 : 11,
              },
              itemStyle: {
                borderColor: '#333',
                borderWidth: 1,
              },
            },
            data: normalizedData,
          },
        ],
      };
      }
    } else {
      // Choropleth Map (for state or country)
      const mapName = mapType === 'country' ? 'world' : 'india';
      
      // Normalize data names to match GeoJSON properties
      const normalizedData = data.map(item => {
        const normalized = normalizeRegionName(item.name, mapType);
        return {
          name: normalized,
          value: item.value,
        };
      });

      // Debug logging
      console.log('🗺️ GeoMap Data Processing:', {
        mapType,
        mapName,
        originalDataSample: data.slice(0, 3).map(d => d.name),
        normalizedDataSample: normalizedData.slice(0, 3),
        totalDataPoints: data.length,
        dataValues: data.map(d => d.value)
      });

      // Calculate min/max for visualMap, handle empty data
      const dataValues = data.map(d => d.value).filter(v => v != null && !isNaN(v));
      let minValue = dataValues.length > 0 ? Math.min(...dataValues) : 0;
      let maxValue = dataValues.length > 0 ? Math.max(...dataValues) : 100;
      
      // If min === max, add a small range to ensure visualMap works
      if (minValue === maxValue && minValue !== 0) {
        minValue = minValue * 0.9;
        maxValue = maxValue * 1.1;
      } else if (minValue === maxValue && minValue === 0) {
        maxValue = 100; // Default range when all values are 0
      }

      // Get all STATE names from GeoJSON for matching verification
      const geoJsonStateNames = mapType === 'state' && mapName === 'india' 
        ? indiaStatesGeoJSON.features.map(f => f.properties.STATE).filter(Boolean)
        : [];
      
      // Check which data points match GeoJSON states
      const matchedStates = normalizedData.filter(d => 
        geoJsonStateNames.includes(d.name)
      );
      const unmatchedStates = normalizedData.filter(d => 
        !geoJsonStateNames.includes(d.name)
      );

      // Log matching information for debugging
      console.log('🗺️ Choropleth Map Configuration:', {
        totalDataPoints: normalizedData.length,
        matchedStates: matchedStates.length,
        unmatchedStates: unmatchedStates.length,
        unmatchedSample: unmatchedStates.slice(0, 3).map(d => d.name),
        dataSample: normalizedData.slice(0, 5),
        valueRange: { min: minValue, max: maxValue },
        mapName,
        nameProperty: mapType === 'state' ? 'STATE' : 'name',
        geoJsonStateCount: geoJsonStateNames.length
      });
      
      if (unmatchedStates.length > 0) {
        console.warn('🗺️ Unmatched state names (will not show colors):', unmatchedStates.map(d => d.name));
      }

      option = {
        tooltip: {
          trigger: 'item',
          formatter: (params) => {
            if (params.value != null && params.value !== undefined) {
              return `<strong>${params.name}</strong><br/><strong>Value:</strong> ${params.value.toLocaleString()}`;
            }
            return `<strong>${params.name}</strong><br/>No data available`;
          },
          textStyle: {
            fontSize: isMobile ? 11 : 12,
          },
        },
        visualMap: {
          type: 'continuous',
          min: minValue,
          max: maxValue,
          text: ['High', 'Low'],
          realtime: false,
          calculable: true,
          seriesIndex: [0], // Explicitly link to the first (and only) series
          inRange: {
            color: ['#e0f3ff', '#006eb8'], // Light blue to dark blue gradient
          },
          outOfRange: {
            color: '#f0f0f0', // Light grey for regions without data
          },
          textStyle: {
            fontSize: isMobile ? 10 : 11,
          },
          left: isMobile ? 10 : 20,
          bottom: isMobile ? 20 : 30,
        },
        series: [
          {
            name: mapType === 'country' ? 'Country' : 'State',
            type: 'map',
            map: mapName,
            roam: true,
            zoom: mapType === 'country' ? 1 : 1.2,
            nameProperty: mapType === 'state' ? 'STATE' : 'name', // Explicitly set name property
            label: {
              show: false, // Hide labels by default to reduce clutter - show only on hover
              fontSize: isMobile ? 8 : 9,
            },
            itemStyle: {
              // Default color for regions without data (should be different from visualMap colors)
              areaColor: '#f0f0f0',
              borderColor: '#999',
              borderWidth: 0.5,
            },
            emphasis: {
              label: {
                show: true,
                fontSize: isMobile ? 10 : 11,
              },
              itemStyle: {
                // Keep the original color on hover - don't override areaColor
                borderColor: '#333',
                borderWidth: 1,
              },
            },
            data: normalizedData,
          },
        ],
      };
    }

    // Ensure option is set
    if (option && Object.keys(option).length > 0) {
      try {
        instanceRef.current.setOption(option, true);
        instanceRef.current.resize();
      } catch (error) {
        console.error('Failed to set chart options:', error);
        console.error('Option that failed:', option);
        // Show error message on map
        try {
          instanceRef.current.setOption({
            title: {
              text: 'Map Rendering Error',
              subtext: error.message,
              left: 'center',
              top: 'middle',
              textStyle: { fontSize: 16, color: '#666' }
            }
          }, true);
        } catch (e) {
          console.error('Failed to set error message:', e);
        }
      }
    } else {
      console.warn('⚠️ No option configured for map. Map type:', mapType, 'Chart subtype:', chartSubType);
    }

    // Add click event handler for cross-filtering
    const handleClick = (params) => {
      if (params.componentType === 'series') {
        const regionName = params.name;
        if (regionName && onRegionClick) {
          // For pincode scatter, use the pincode
          // For choropleth, use the region/country name
          onRegionClick(mapType === 'pincode' ? regionName : denormalizeRegionName(regionName, mapType));
        }
      }
    };

    // Remove old handler and add new one
    instanceRef.current.off('click');
    instanceRef.current.on('click', handleClick);

    return () => {
      if (instanceRef.current) {
        instanceRef.current.off('click', handleClick);
      }
    };
  }, [isReady, data, mapType, chartSubType, isMobile, onRegionClick]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (instanceRef.current) {
        instanceRef.current.resize();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (instanceRef.current) {
        instanceRef.current.dispose();
        instanceRef.current = null;
      }
    };
  }, []);

  const isMobileState = isMobile || window.innerWidth <= 768;

  return (
    <div style={{
      background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
      borderRadius: isMobileState ? '12px' : '16px',
      padding: '0',
      border: '1px solid #e2e8f0',
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      maxHeight: '100%',
      overflow: 'hidden',
      width: '100%',
      maxWidth: '100%',
      position: 'relative'
    }}>
      {customHeader ? (
        <div style={{ 
          padding: isMobileState ? '12px 16px' : '16px 20px',
          position: 'sticky',
          top: 0,
          background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
          zIndex: 10,
          marginBottom: '0'
        }}>
          {customHeader}
        </div>
      ) : null}
      <div style={{
        padding: '0',
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        overflowX: 'hidden',
        background: 'radial-gradient(circle at top, rgba(59, 130, 246, 0.03) 0%, transparent 50%)',
        width: '100%',
        maxWidth: '100%',
        position: 'relative'
      }}>
        {showBackButton && onBackClick && (
          <button
            onClick={onBackClick}
            style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              zIndex: 10,
              padding: '6px 12px',
              background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
              color: '#475569',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: isMobileState ? '11px' : '13px',
              fontWeight: '600',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%)';
              e.target.style.transform = 'translateY(-1px)';
              e.target.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)';
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)';
            }}
          >
            <span className="material-icons" style={{ fontSize: isMobileState ? '16px' : '18px' }}>arrow_back</span>
            {!isMobileState && <span>Back</span>}
          </button>
        )}
        <div
          ref={chartRef}
          style={{
            width: '100%',
            height: '100%',
            minHeight: isMobileState ? '280px' : '320px',
            flex: 1,
            borderRadius: isMobileState ? '8px' : '12px',
            overflow: 'hidden',
            background: 'white',
            boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)'
          }}
        />
      </div>
    </div>
  );
};

// Helper function to normalize region names for matching with GeoJSON
const normalizeRegionName = (name, mapType) => {
  if (!name) {
    console.warn('🗺️ normalizeRegionName: Empty name provided');
    return '';
  }
  
  // Clean the name: trim, remove extra spaces, standardize
  let normalized = name.toString()
    .trim()
    .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
    .replace(/[^\w\s&-]/g, ''); // Remove special characters except &, -, and spaces
  
  // Common replacements for India states (to match GeoJSON STATE property in UPPERCASE)
  const indiaStateMap = {
    'andhra pradesh': 'ANDHRA PRADESH',
    'arunachal pradesh': 'ARUNACHAL PRADESH',
    'assam': 'ASSAM',
    'bihar': 'BIHAR',
    'chhattisgarh': 'CHHATTISGARH',
    'chattisgarh': 'CHHATTISGARH', // Common misspelling
    'goa': 'GOA',
    'gujarat': 'GUJARAT',
    'haryana': 'HARYANA',
    'himachal pradesh': 'HIMACHAL PRADESH',
    'jharkhand': 'JHARKHAND',
    'karnataka': 'KARNATAKA',
    'kerala': 'KERALA',
    'madhya pradesh': 'MADHYA PRADESH',
    'mp': 'MADHYA PRADESH',
    'maharashtra': 'MAHARASHTRA',
    'manipur': 'MANIPUR',
    'meghalaya': 'MEGHALAYA',
    'mizoram': 'MIZORAM',
    'nagaland': 'NAGALAND',
    'odisha': 'ODISHA',
    'orissa': 'ODISHA', // Alternate name
    'punjab': 'PUNJAB',
    'rajasthan': 'RAJASTHAN',
    'sikkim': 'SIKKIM',
    'tamil nadu': 'TAMIL NADU',
    'tamilnadu': 'TAMIL NADU',
    'tn': 'TAMIL NADU',
    'telangana': 'TELANGANA',
    'tripura': 'TRIPURA',
    'uttar pradesh': 'UTTAR PRADESH',
    'up': 'UTTAR PRADESH',
    'uttarakhand': 'UTTARAKHAND',
    'uttaranchal': 'UTTARAKHAND', // Old name
    'west bengal': 'WEST BENGAL',
    'wb': 'WEST BENGAL',
    'delhi': 'DELHI',
    'nct of delhi': 'DELHI',
    'new delhi': 'DELHI',
    'jammu and kashmir': 'JAMMU AND KASHMIR',
    'jammu & kashmir': 'JAMMU AND KASHMIR',
    'jk': 'JAMMU AND KASHMIR',
    'j&k': 'JAMMU AND KASHMIR',
    'ladakh': 'LADAKH',
    'puducherry': 'PUDUCHERRY',
    'pondicherry': 'PUDUCHERRY', // Old name
    'chandigarh': 'CHANDIGARH',
    'andaman and nicobar islands': 'ANDAMAN AND NICOBAR ISLANDS',
    'andaman & nicobar islands': 'ANDAMAN AND NICOBAR ISLANDS',
    'andaman and nicobar': 'ANDAMAN AND NICOBAR ISLANDS',
    'a&n islands': 'ANDAMAN AND NICOBAR ISLANDS',
    'dadra and nagar haveli': 'DADRA AND NAGAR HAVELI AND DAMAN AND DIU',
    'dadra & nagar haveli': 'DADRA AND NAGAR HAVELI AND DAMAN AND DIU',
    'dnh': 'DADRA AND NAGAR HAVELI AND DAMAN AND DIU',
    'daman and diu': 'DADRA AND NAGAR HAVELI AND DAMAN AND DIU',
    'daman & diu': 'DADRA AND NAGAR HAVELI AND DAMAN AND DIU',
    'dadra and nagar haveli and daman and diu': 'DADRA AND NAGAR HAVELI AND DAMAN AND DIU',
    'dadra & nagar haveli & daman & diu': 'DADRA AND NAGAR HAVELI AND DAMAN AND DIU',
    'lakshadweep': 'LAKSHADWEEP',
  };

  // Common replacements for countries
  const countryMap = {
    'usa': 'United States of America',
    'united states': 'United States of America',
    'us': 'United States of America',
    'uk': 'United Kingdom',
    'uae': 'United Arab Emirates',
  };

  const lowerName = normalized.toLowerCase();
  
  if (mapType === 'state') {
    // Try mapping first, then convert to uppercase
    const mapped = indiaStateMap[lowerName] || normalized.toUpperCase();
    console.log(`🗺️ State name mapping: "${name}" → "${lowerName}" → "${mapped}"`);
    return mapped;
  } else if (mapType === 'country') {
    return countryMap[lowerName] || normalized;
  }
  
  return normalized;
};

// Helper function to convert normalized name back to original format
const denormalizeRegionName = (name, mapType) => {
  // For now, return as-is since we want to filter by the original data field value
  // The filtering logic will handle the normalization
  return name;
};

export default GeoMapChart;

