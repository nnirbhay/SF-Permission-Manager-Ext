
import React, { useState } from 'react';
import { Drawer, Typography, Divider, Empty } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import '../utilities/globalCssLibrary.css'
import '../utilities/productGlobalStyles.css'

const { Title, Text } = Typography;

const RecordAccessAnalyzer = ({ visible, onClose }) => {
    if (!visible) return <></>;
    return (
        <div className='right-slider'>
            <div className='d-f j-c-s-b a-i-c p-a-m b-rad-4-px bg-c-w b-1-px b-c-b-5 cur-pointer tran-a-l-2 hover-bg-light'>
                <span className='fs-14-px c-b-1'>Record Access Analyzer</span>
                <div onClick={() => onClose()} >
                    <CloseOutlined className='c-b-3' />
                </div>
            </div>
            <div className='p-a-m'>
                <Title level={5} style={{ color: '#fff', marginTop: 0 }}>Analyzer Panel</Title>
            </div>
        </div>
    );
};

export default RecordAccessAnalyzer;
