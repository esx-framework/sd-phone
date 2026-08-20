-- Fixed cameras the MDT can look through: banks, 24/7s, liquor stores, hardware shops
-- and gun stores. Watching one moves the VIEWING officer's own camera to that spot, the
-- way a CCTV monitor does, and puts it back when they leave. Nobody else is affected.
--
-- The coordinates came from this server's own shop and bank data, so a camera sits where
-- the store actually is rather than where a generic list guessed. Re-run the generator if
-- you move a shop. `coords` is where the camera hangs, `look` is what it points at.
return {
    -- Whether the CCTV section works at all.
    Enabled = true,

    -- Seconds a camera view is held before it drops the streaming focus, so a viewer
    -- flicking between cameras does not thrash the world stream.
    FocusGraceSeconds = 3,

    -- Field of view. Lower is more zoomed in.
    Fov = 62.0,

    Cameras = {
        -- Bank
        { id = 'pacific_standard_vinewood', label = 'Pacific Standard, Vinewood', category = 'Bank',
          coords = vec3(241.97, 230.35, 108.64), look = vec3(241.44, 227.19, 106.89) },
        { id = 'fleeca_legion_square', label = 'Fleeca, Legion Square', category = 'Bank',
          coords = vec3(312.66, -283.55, 56.51), look = vec3(313.84, -280.58, 54.76) },
        { id = 'fleeca_alta_st', label = 'Fleeca, Alta St', category = 'Bank',
          coords = vec3(148.13, -1045, 31.72), look = vec3(149.46, -1042.09, 29.97) },
        { id = 'fleeca_burton', label = 'Fleeca, Burton', category = 'Bank',
          coords = vec3(-352.23, -54.32, 51.39), look = vec3(-351.23, -51.28, 49.64) },
        { id = 'fleeca_del_perro', label = 'Fleeca, Del Perro', category = 'Bank',
          coords = vec3(-1210.8, -334.91, 40.13), look = vec3(-1211.9, -331.9, 38.38) },
        { id = 'fleeca_banham_canyon', label = 'Fleeca, Banham Canyon', category = 'Bank',
          coords = vec3(-2957.96, 482.75, 18.05), look = vec3(-2961.14, 483.09, 16.3) },
        { id = 'fleeca_harmony_route_68', label = 'Fleeca, Harmony / Route 68', category = 'Bank',
          coords = vec3(1174.88, 2711.4, 40.44), look = vec3(1174.8, 2708.2, 38.69) },
        { id = 'blaine_county_savings_paleto_bay', label = 'Blaine County Savings, Paleto Bay', category = 'Bank',
          coords = vec3(-109.93, 6473.24, 33.98), look = vec3(-112.22, 6471.01, 32.23) },

        -- 24/7
        { id = '24_7_1', label = '24/7 1', category = '24/7',
          coords = vec3(28, -1345, 31.84), look = vec3(25.7, -1347.3, 30.09) },
        { id = '24_7_2', label = '24/7 2', category = '24/7',
          coords = vec3(-3036.41, 588.2, 10.25), look = vec3(-3038.71, 585.9, 8.5) },
        { id = '24_7_3', label = '24/7 3', category = '24/7',
          coords = vec3(-3239.17, 1003.44, 15.18), look = vec3(-3241.47, 1001.14, 13.43) },
        { id = '24_7_4', label = '24/7 4', category = '24/7',
          coords = vec3(1730.96, 6416.46, 37.38), look = vec3(1728.66, 6414.16, 35.63) },
        { id = '24_7_5', label = '24/7 5', category = '24/7',
          coords = vec3(1700.29, 4926.7, 44.41), look = vec3(1697.99, 4924.4, 42.66) },
        { id = '24_7_6', label = '24/7 6', category = '24/7',
          coords = vec3(1963.78, 3742.26, 34.69), look = vec3(1961.48, 3739.96, 32.94) },
        { id = '24_7_7', label = '24/7 7', category = '24/7',
          coords = vec3(550.09, 2674.09, 44.5), look = vec3(547.79, 2671.79, 42.75) },
        { id = '24_7_8', label = '24/7 8', category = '24/7',
          coords = vec3(2681.55, 3282.42, 57.59), look = vec3(2679.25, 3280.12, 55.84) },
        { id = '24_7_9', label = '24/7 9', category = '24/7',
          coords = vec3(2560.24, 384.35, 110.97), look = vec3(2557.94, 382.05, 109.22) },
        { id = '24_7_10', label = '24/7 10', category = '24/7',
          coords = vec3(375.85, 327.86, 105.91), look = vec3(373.55, 325.56, 104.16) },

        -- Liquor Store
        { id = 'liquor_store_1', label = 'Liquor Store 1', category = 'Liquor Store',
          coords = vec3(1138.11, -979.98, 48.77), look = vec3(1135.81, -982.28, 47.02) },
        { id = 'liquor_store_2', label = 'Liquor Store 2', category = 'Liquor Store',
          coords = vec3(-1220.62, -904.68, 14.68), look = vec3(-1222.91, -906.98, 12.93) },
        { id = 'liquor_store_3', label = 'Liquor Store 3', category = 'Liquor Store',
          coords = vec3(-1485.25, -376.81, 42.51), look = vec3(-1487.55, -379.11, 40.76) },
        { id = 'liquor_store_4', label = 'Liquor Store 4', category = 'Liquor Store',
          coords = vec3(-2965.94, 393.21, 17.39), look = vec3(-2968.24, 390.91, 15.64) },
        { id = 'liquor_store_5', label = 'Liquor Store 5', category = 'Liquor Store',
          coords = vec3(1168.32, 2711.23, 40.51), look = vec3(1166.02, 2708.93, 38.76) },
        { id = 'liquor_store_6', label = 'Liquor Store 6', category = 'Liquor Store',
          coords = vec3(1394.86, 3606.98, 37.33), look = vec3(1392.56, 3604.68, 35.58) },
        { id = 'liquor_store_7', label = 'Liquor Store 7', category = 'Liquor Store',
          coords = vec3(-1391.11, -604.32, 32.67), look = vec3(-1393.41, -606.62, 30.92) },

        -- YouTool
        { id = 'youtool_1', label = 'YouTool 1', category = 'YouTool',
          coords = vec3(2750.3, 3475.3, 58.02), look = vec3(2748, 3473, 56.27) },
        { id = 'youtool_2', label = 'YouTool 2', category = 'YouTool',
          coords = vec3(345.29, -1295.96, 34.86), look = vec3(342.99, -1298.26, 33.11) },

        -- Ammunation
        { id = 'ammunation_1', label = 'Ammunation 1', category = 'Ammunation',
          coords = vec3(-659.88, -932.66, 24.18), look = vec3(-662.18, -934.96, 22.43) },
        { id = 'ammunation_2', label = 'Ammunation 2', category = 'Ammunation',
          coords = vec3(812.55, -2155.3, 31.97), look = vec3(810.25, -2157.6, 30.22) },
        { id = 'ammunation_3', label = 'Ammunation 3', category = 'Ammunation',
          coords = vec3(1695.74, 3762.46, 37.06), look = vec3(1693.44, 3760.16, 35.31) },
        { id = 'ammunation_4', label = 'Ammunation 4', category = 'Ammunation',
          coords = vec3(-327.94, 6086.18, 33.8), look = vec3(-330.24, 6083.88, 32.05) },
        { id = 'ammunation_5', label = 'Ammunation 5', category = 'Ammunation',
          coords = vec3(254.93, -47.7, 72.29), look = vec3(252.63, -50, 70.54) },
        { id = 'ammunation_6', label = 'Ammunation 6', category = 'Ammunation',
          coords = vec3(24.86, -1107.59, 32.15), look = vec3(22.56, -1109.89, 30.4) },
        { id = 'ammunation_7', label = 'Ammunation 7', category = 'Ammunation',
          coords = vec3(2569.99, 296.68, 111.08), look = vec3(2567.69, 294.38, 109.33) },
        { id = 'ammunation_8', label = 'Ammunation 8', category = 'Ammunation',
          coords = vec3(-1115.28, 2700.91, 20.9), look = vec3(-1117.58, 2698.61, 19.15) },
        { id = 'ammunation_9', label = 'Ammunation 9', category = 'Ammunation',
          coords = vec3(844.74, -1031.12, 30.54), look = vec3(842.44, -1033.42, 28.79) },

    },
}
