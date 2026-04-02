import { MapType, MediaAssetType } from "@videofy/types";
import { Form, InputNumber, Modal } from "antd";
import { useForm } from "antd/es/form/Form";
import Map from "./Map";
import ReplaceMedia from "./ReplaceMedia";

const EditMap = ({
  map,
  onClose,
  onSave,
  alternativeMedia = [],
}: {
  map?: MapType;
  onClose: () => void;
  onSave: (asset?: MediaAssetType) => void;
  alternativeMedia?: MediaAssetType[];
}) => {
  const [form] = useForm();
  type FormType = {
    lat: number;
    lon: number;
  };

  const handleFinish = (location: FormType) => {
    const newMap: MapType = map
      ? { ...map, location }
      : { type: "map", location };
    onSave(newMap);
    onClose();
  };

  return (
    <Modal open onCancel={onClose} onOk={() => form.submit()}>
      <Form
        form={form}
        onFinish={handleFinish}
        initialValues={map?.location}
        layout="vertical"
      >
        <Form.Item shouldUpdate>
          {() => (
            <div
              key={`${form.getFieldValue("lat")}+${form.getFieldValue("lon")}`}
            >
              <Map location={form.getFieldsValue(["lat", "lon"])} zoom={6} />
            </div>
          )}
        </Form.Item>
        <Form.Item name="lat" label="Latitude">
          <InputNumber />
        </Form.Item>
        <Form.Item name="lon" label="Longitude">
          <InputNumber />
        </Form.Item>
        <ReplaceMedia
          alternativeMedia={alternativeMedia}
          onSelectMedia={(selectedAsset) => {
            onSave(selectedAsset);
          }}
        />
      </Form>
    </Modal>
  );
};

export default EditMap;
